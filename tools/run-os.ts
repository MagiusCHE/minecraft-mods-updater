const os = Deno.build.os;

// console.log(`Running on ${os}`, Deno.args);
async function streamOutput(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            const text = decoder.decode(value);
            await Deno.stdout.write(new TextEncoder().encode(text));
        }
    }
}

async function runCommand(command: string, args: string[]) {
    const cmd = new Deno.Command(command, {
        args,
        stdout: "inherit",
        stderr: "inherit",
    });

    const child = cmd.spawn();

    // Streaming stdout and stderr concurrently
    /*await Promise.all([
        streamOutput(child.stdout),
        streamOutput(child.stderr),
    ]);*/

    const { code } = await child.status;
    if (code !== 0) {
        //console.error(`Process exited with code ${code}`);
        
    }
    Deno.exit(code);
}

await runCommand("deno", ["task", Deno.args[0] + ":" + os,...Deno.args.splice(1)]);
