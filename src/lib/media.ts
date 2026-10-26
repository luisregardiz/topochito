import "server-only";
import * as cloudinary from "./cloudinary-url";
import { getEnv } from "./env";

// Sin CLOUDINARY_CLOUD_NAME (o con un ID inválido) no hay medio y la app muestra sus placeholders.
function build(id: string | null, make: (cloud: string, id: string) => string) {
  const cloud = getEnv().CLOUDINARY_CLOUD_NAME;
  return cloud && id && cloudinary.isValidPublicId(id) ? make(cloud, id) : null;
}

export const thumbUrlOf = (id: string | null) => build(id, cloudinary.thumbUrl);
export const heroUrlOf = (id: string | null) => build(id, cloudinary.heroUrl);

export function videoOf(id: string | null) {
  const src = build(id, cloudinary.videoUrl);
  const poster = build(id, cloudinary.videoPosterUrl);
  return src && poster ? { src, poster } : null;
}
