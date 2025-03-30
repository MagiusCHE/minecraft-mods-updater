import { FabricMod } from "../schema/fabric.d.ts";
import { ModInfo, ModInfoLoader } from "./base.ts";
import debug from "npm:debug";

const log = debug('mmu:FMILoader');

export class FabricModInfoLoader extends ModInfoLoader {
    static pushLoaders() {

        ModInfoLoader.pushMFLoader("/META-INF/MANIFEST.MF");
        ModInfoLoader.pushTOMLLoader("/META-INF/mods.toml");
        ModInfoLoader.pushJSONLoader("/fabric.mod.json");
    }

    static analyze(filePath: string, contents: any): (ModInfo & FabricMod) | undefined {
        if (!contents["fabric.mod.json"]) {
            return undefined
        }
        let mcMinVersion: string | undefined = contents["META-INF"]?.["MANIFEST.MF"]?.["Fabric-Minecraft-Version"] || contents["META-INF"]?.["MANIFEST.MF"]?.["Implementation-Version"]
        let mcMaxVersion: string | undefined = mcMinVersion
        //let name: string | undefined
        //let id: string | undefined
        const mods = contents["META-INF"]?.["mods.toml"]
        if (!mcMinVersion && mods) {
            // mods.toml version            
            const mod = mods.mods[0]
            const vRange = mods.dependencies?.[mod.modId]?.find?.((m: Record<string, unknown>) => m.modId == "minecraft")?.versionRange
            //log(`contents["META-INF"]?.mods?.dependencies`, contents["META-INF"]?.mods?.dependencies?.[mods.modId], mods.modId, vRange)
            if (vRange) {
                const [rMin, rMax] = vRange.toString().replace(/[\[\]\(\)]/g, "").split(",")
                mcMinVersion = rMin.trim()
                mcMaxVersion = rMax.trim()
                if (!mcMaxVersion?.length)
                    mcMaxVersion = mcMinVersion
            }
        }

        /*if (!metaInfoManifest) {
            log(" ### Dump of %o: %o","META-INF", contents["META-INF"]);
            throw new Error(`Fabric Mod "META-INF/MANIFEST.MF" is missing. Cant load \"${filePath}\".`);
        }*/
        if (!mcMinVersion?.length || !mcMaxVersion?.length) {
            throw new Error(`Fabric Mod "META-INF/MANIFEST.MF" or "META-INF/mods.toml" are missing or invalid. Unable to extract Minecraft version required. Cant load \"${filePath}\".`);
        }

        const modInfo = {
            mcVersion: {
                min: mcMinVersion,
                max: mcMaxVersion
            },
            loader: "fabric",
            filePath: filePath,
            ...contents["fabric.mod.json"] as FabricMod
        };

        return modInfo;

    }
}