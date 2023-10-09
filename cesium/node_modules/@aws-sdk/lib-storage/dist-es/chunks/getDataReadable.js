import { Buffer } from "buffer";
export async function* getDataReadable(data) {
    for await (const chunk of data) {
        yield Buffer.from(chunk);
    }
}
