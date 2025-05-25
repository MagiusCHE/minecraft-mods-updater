import debug from "debug";
import { Command } from "@cliffy/command";
//import { loadObjectFromZipFile } from "https://raw.githubusercontent.com/MagiusCHE/zip-to-object/refs/heads/main/mod.ts";
import { loadObjectFromZipFile } from "@scroogieboy/zip-to-object";
import { fileExists, filenameToUrl } from "./helper.ts";
import { FabricModInfoLoader } from "./loader/fabric.ts";
import { ModInfo } from "./loader/base.ts";
import { ModDownloadResult, ModDownloadType, ModProvider } from "./providers/mod_provider.ts";
import { Modrinth } from "./providers/modrinth.ts";
import { basename, join } from "@std/path";
import { CourseForge } from "./providers/courseforge.ts";
import { defaultLoaders } from "@scroogieboy/directory-to-object";

const log = debug('mmu:App');

debug.enable('mmu:*');

defaultLoaders.length = 0; // clear default loaders

class App {
    private providers: ModProvider[] = [];
    constructor(readonly options: MMUOptions, readonly modsSourcePath: string) {
        log("App created with options:", options);
        log(" - Source mods path:", modsSourcePath);
        //this.providers.push(new CourseForge());
        this.providers.push(new Modrinth());
        this.providers.push(new CourseForge());
        //this.providers.push(new GitHub());

        FabricModInfoLoader.pushLoaders();
    }
    async run() {
        log(">> Begin mods update process...");


        // scan all files in the source path
        log(" - Scan mods source path: %o", this.modsSourcePath);
        const sourceFiles = [];
        for await (const dirEntry of Deno.readDir(this.modsSourcePath)) {
            // check only .jar files
            if (dirEntry.isFile && dirEntry.name.endsWith(".jar")) {
                // Analyse jar file to discover what minecraft loader is used (Forge, Fabric, etc.)
                // and what is the mod version
                // jar file is a zip file, so we can use the zip module to read it
                const filePath = `${this.modsSourcePath}/${dirEntry.name}`;
                const info = await this.extractModInfo(filePath)
                if (info) {
                    log("   - %o %s [Fabric]", info.name, info.version);
                    sourceFiles.push(info);
                }
            }
        }
        if (!sourceFiles.length) {
            log("   - No mods found.");
            return;
        }

        log(" - Found %o mods.", sourceFiles.length);


        await Deno.mkdir(this.options.outputPath, { recursive: true });

        const toDownloadUrls: Record<string, ModDownloadType & {
            rootMod: ModInfo
        }> = {};
        log(" - Scan %o providers for new mods", this.providers.length);
        const missingMods: ModInfo[] = [];
        for (const m of sourceFiles) {
            //log("   - %o %s", m.name, m.version);
            const result = await this.getModDownloadFor(m)
            if (!result?.length) {
                log("   - %o: no downloads for MC v%o", m.name, this.options.targetVersion);
                missingMods.push(m);
            } else {
                //log("     - found %o downloads", result.length);
                result.forEach(r => {
                    toDownloadUrls[r.url] = {
                        ...r,
                        rootMod: m,
                    }
                })
            }
            //log(" - Found %o %s %o", m.name, m.version, result);
        }

        let lastRootMod: ModInfo | undefined;
        //log(" - Found %o mods to download.", Object.keys(toDownloadUrls).length);

        for (const [modUrl, modInfo] of Object.entries(toDownloadUrls)) {
            const rootMod = modInfo.rootMod;
            const newMod = modInfo;
            if (lastRootMod != rootMod) {
                log("   - %o %s", rootMod.name, rootMod.version)
                lastRootMod = rootMod;
            }
            let targetPath: string | undefined;
            if (newMod.canReuseOriginal && newMod.originalFullPath?.length) {
                // copy the original mod to the output path
                log("     - %s => %o (%o)", newMod.provider, newMod.originalFullPath!, newMod.version);
                targetPath = join(this.options.outputPath, basename(newMod.originalFullPath!));
                const sourcePath = newMod.originalFullPath;
                //log("   - Reuse original mod %o to %o", sourcePath, targetPath);
                await Deno.copyFile(sourcePath, targetPath);

            } else {
                // download the mod from the url
                targetPath = join(this.options.outputPath, newMod.fileName);
                log("     - %s => %o (%s)", newMod.provider, newMod.fileName, newMod.version);
                //log("   - Download %o to %o", newMod.url, targetPath);
                const res = await fetch(newMod.url);
                if (!res.ok) {
                    throw new Error(`Failed to fetch url ${newMod.url}: ${res.statusText}`);
                }
                const file = await Deno.open(targetPath, { write: true, create: true });
                const writer = file.writable.getWriter();
                const reader = res.body?.getReader();
                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        await writer.write(value);
                    }
                    writer.releaseLock();
                    file.close();
                }
            }
            //log("   - Saved into %o", targetPath);

        }
        if (missingMods.length) {
            log(" - Missing mods: %o/%i %o", missingMods.length, sourceFiles.length, missingMods.map(m => m.name).join(", "));
            log(" - Available mods stored into %o", this.options.outputPath);
        } else {
            log(" - All mods stored into %o", this.options.outputPath);
        }
        log("<< Mod updates done.");
        //log (" - Loader version:",sourceFiles[0].mcVersion)
    }
    async getModDownloadFor(mod: ModInfo): Promise<ModDownloadResult | undefined> {
        for (const provider of this.providers) {
            //log(" - Checking provider %o for mod %o", provider.Name, mod.name);
            const result = await provider.getModDownloadFor(mod, this.options.targetVersion);
            if (result && result.length) {
                return result;
            }
        }
        return undefined
    }
    async extractModInfo(filePath: string): Promise<ModInfo | undefined> {
        const zipFileUrl = filenameToUrl(filePath);
        let contents: Record<string, unknown> | undefined
        try {
            //log(" - Default loaders: ", defaultLoaders.map(l => l.name));
            contents = await loadObjectFromZipFile(zipFileUrl);
        } catch (err) {
            log(" - Error loading zip file %o: %o", filePath, err);
            return undefined;
        }

        const fabricMod = FabricModInfoLoader.analyze(filePath, contents);
        if (fabricMod) {
            return fabricMod;
        }

        //log(" - %o info: ", filePath, info);
        throw new Error("Not implemented yet: invalid mod file format. " + filePath);
    }
}

type MMUOptions = {
    targetVersion: string,
    outputPath: string,
}

if (import.meta.main) {
    (async () => {
        if (await fileExists(".env")) {
            (await Deno.readTextFile(".env")).split("\n").forEach(line => {
                const [key, value] = line.split("=");
                if (key?.length && value?.length) {
                    Deno.env.set(key.trim(), value.trim());
                }
            })
        }
        await new Command()
            .name("Minecraft Mods Updater")
            .version("0.0.1")
            .description("Minecraft Mods Updater: a command line updater for minecraft mods. It downloads all new mod versions for a target minecraft version - by magiusche@magius.it")
            .arguments("<source-mods-path:string>")
            .action((options: any, ...sources: string[]) => {
                try {
                    new App(options as unknown as MMUOptions, sources[0].trim()).run();
                } catch (error: unknown) {
                    log(error);
                    log("Options was: ", options);
                    Deno.exit(1);
                }
            })
            .option("-t, --target-version <minecraft-version:string>", "Target version: ex: \"1.20.1\"", { default: "latest" })
            .option("-o, --output-path <mods-output-path:string>", "Target mods path to put new mods", { required: true })
            .parse(Deno.args)
    })();
}
