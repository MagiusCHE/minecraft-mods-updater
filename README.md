# Minecraft Mods Updater
Simple CLI command to traspose all your existing mods from one version of MC to another.

## Usage 
### Without build binary
```bash
deno --allow-env --allow-read --allow-write --allow-net src/app.ts -t 1.21.5 "/home/.minecraft/home/Fabric 1.21.4/mods" -o "/home/.minecraft/home/Fabric 1.21.5/mods"
```

### Using binary
(it doesn't work at the moment: linux)
```bash
mmu -t 1.21.5 "/home/.minecraft/home/Fabric 1.21.4/mods" -o "/home/.minecraft/home/Fabric 1.21.5/mods"
```

## Build
```bash
deno task build
```
This produces `dist/mmu` binary

## Loader
- Fabric (implemented)
- Forge (not implemented)
- Others... (todo)

## Providers
- CourseForge
- Modrinth
