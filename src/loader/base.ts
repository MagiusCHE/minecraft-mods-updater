import { parse as tomlParse } from "@std/toml";
import { defaultLoaders, Loaders } from "@scroogieboy/directory-to-object";

export class ModInfoLoader {
    static pushMFLoader(fullPath: string) {
        const name = fullPath;
        if (!defaultLoaders.find(l => l.name == name)) {
            const mfLoader = Loaders.customFile({
                name: name,
                parser: (t: string) => {
                    const content: Record<string, string> = {};
                    t.split("\n").map(l => l.trim()).filter(l => l.length).forEach(l => {
                        //log(" - Parsing line: %o", l);
                        const [k, v] = l.split(":")
                        if (!k?.length || !v?.length) {
                            return;
                        }
                        content[k.trim()] = v.trim();
                    })
                    return content;
                },
            }).whenPathMatches(name);
            defaultLoaders.push(mfLoader);
        }
    }
    static pushTOMLLoader(fullPath: string) {
        const name = fullPath;
        if (!defaultLoaders.find(l => l.name == name)) {
            const tomlLoader = Loaders.customFile({
                name: name,
                parser: (t: string) => {
                    if (!t.length)
                        return {};
                    return tomlParse(t);
                },
            }).whenPathMatches(name);
            defaultLoaders.push(tomlLoader);
        }
    }

    static pushJSONLoader(fullPath: string) {
        const name = fullPath;
        if (!defaultLoaders.find(l => l.name == name)) {
            const jsonLoader = Loaders.customFile({
                name: name,
                parser: JSON.parse,
            }).whenPathMatches(name);
            defaultLoaders.push(jsonLoader);
        }
    }
}

export type ModInfo = {
    mcVersion: {
        min: string;
        max: string;
    };
    loader: string;
    filePath: string;
    name: string;
    id: string;
    version: string;
}

