export function filenameToUrl(filename: string): URL {
    // Sostituisci le barre rovesciate con barre dirette per compatibilità con URL
    const normalizedFilename = filename.replace(/\\/g, '/');

    // Gestisci le lettere di unità (es. C:)
    if (/^[a-zA-Z]:/.test(normalizedFilename)) {
        return new URL(`file:///${normalizedFilename}`);
    } else {
        // Percorsi relativi o assoluti (Unix-like)
        return new URL(`file://${normalizedFilename}`);
    }
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await Deno.lstat(filePath);
        return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        } else {
            console.error(`Errore durante il controllo del file: ${error}`);
            return false;
        }
    }
}