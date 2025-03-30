export type FabricMod = {
    id: string;
    version: string;
    name: string;
    description: string;
    authors: string[];
    contributors: string[];
    environment?: "client" | "server" | "both";
    depends?: Record<string, string>;
};