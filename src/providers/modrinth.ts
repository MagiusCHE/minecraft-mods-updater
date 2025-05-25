import { ModDownloadResult, ModProvider } from "./mod_provider.ts";
import { ModInfo } from "../loader/base.ts";
import debug from "npm:debug";
const log = debug('mmu:Modrinth');

const apiEntryPoint = "https://api.modrinth.com/v2";

const commands = {
    getVersions: `${apiEntryPoint}/project/:id/version`,
    search: `${apiEntryPoint}/search?query=:query`,
}

export class Modrinth extends ModProvider {

    public override async getModDownloadFor(mod: ModInfo, targetMCVersion: string): Promise<ModDownloadResult | undefined> {
        const ret = await super.getModDownloadFor(mod, targetMCVersion);
        if (!ret?.length) {
            // no download found, try to search based on mod name
            const search = await this.APICall(`${commands.search.replace(":query", mod.name)}`);
            for (const hit of search.hits) {
                if (!hit.project_type)
                    continue
                if (!hit.categories.includes(mod.loader))
                    continue
                if (!hit.versions.includes(targetMCVersion))
                    continue
                return this.getModInfoFor(hit.project_id, targetMCVersion, mod.loader, mod.filePath);

            }
        }
        return ret
    }
    protected override async getModInfoFor(modId: string, targetMCVersion: string, loader: string, originalFullPath?: string, resolvedDependencies?: string[]): Promise<ModDownloadResult> {

        resolvedDependencies = resolvedDependencies || [];
        const ret: ModDownloadResult = []
        const versions = await this.API_GetVersions(modId);

        if (!versions) {
            return ret
        }

        const version = versions.filter((v: any) => {
            if (!v.game_versions.includes(targetMCVersion)) {
                return false;
            }
            if (v.loaders && !v.loaders.includes(loader)) {
                return false;
            }
            return true
        })?.[0]
        if (!version) {
            return ret;
        }

        //log(">> Modrinth: Found version %s for mod %s", version.version_number, modId);

        version.files.forEach((f: any) => {
            if (f.url) {
                ret.push({
                    url: f.url as string,
                    fileName: f.filename as string,
                    //originalFullPath: originalFullPath,
                    canReuseOriginal: false,
                    version: version.version_number,
                    provider: this.Name,
                })
            }
        })

        for (const dep of version.dependencies) {
            if (resolvedDependencies.includes(dep.project_id)) {
                continue; // already resolved this dependency
            }
            resolvedDependencies.push(dep.project_id);
            const depVersions = await this.getModInfoFor(dep.project_id, targetMCVersion, loader, undefined, resolvedDependencies);
            depVersions?.forEach(f => ret.push(f))
        }

        return ret
    }

    private async API_GetVersions(modId: string): Promise<any> {
        return this.APICall(commands.getVersions.replace(":id", modId));
    }

}