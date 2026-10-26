import { ZstdCodec } from "zstd-codec";

let zstdInstance: any = null;

async function getZstd(): Promise<any> {
  if (zstdInstance) return zstdInstance;
  return new Promise((resolve) => {
    ZstdCodec.run((zstd: any) => {
      zstdInstance = new zstd.Simple();
      resolve(zstdInstance);
    });
  });
}

/**
 * Compress 25KB body payloads with Zstd (with native compression fallback)
 */
export async function compressPayload(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  try {
    const zstd = await getZstd();
    return zstd.compress(bytes);
  } catch {
    // Fallback using Web CompressionStream
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buf);
  }
}

/**
 * Decompress body payloads
 */
export async function decompressPayload(compressedBytes: Uint8Array): Promise<string> {
  try {
    const zstd = await getZstd();
    const decompressed = zstd.decompress(compressedBytes);
    return new TextDecoder().decode(decompressed);
  } catch {
    // Fallback using Web DecompressionStream
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder().decode(buf);
  }
}
