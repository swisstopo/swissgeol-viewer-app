export async function* getChunkBuffer(data, partSize) {
    let partNumber = 1;
    let startByte = 0;
    let endByte = partSize;
    while (endByte < data.byteLength) {
        yield {
            partNumber,
            data: data.slice(startByte, endByte),
        };
        partNumber += 1;
        startByte = endByte;
        endByte = startByte + partSize;
    }
    yield {
        partNumber,
        data: data.slice(startByte),
        lastPart: true,
    };
}
