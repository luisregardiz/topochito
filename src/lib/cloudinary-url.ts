// URLs de Cloudinary a partir de un public ID. Puro (sin entorno) para poder probarlo.
// Imágenes: f_auto/q_auto eligen formato y calidad; el recorte lo hace Cloudinary (no el optimizador de Next).
// Video: se sirve el mp4 transcodificado; el póster es el primer fotograma.

// Solo letras, números, «_», «-» y «/»: el ID se inserta en la ruta de la URL.
const PUBLIC_ID = /^[A-Za-z0-9_\-/]{1,200}$/;
export const isValidPublicId = (id: string) => PUBLIC_ID.test(id);

const base = (cloud: string, kind: "image" | "video") =>
  `https://res.cloudinary.com/${encodeURIComponent(cloud)}/${kind}/upload`;

// Miniatura cuadrada de 88 px (a 2x).
export const thumbUrl = (cloud: string, id: string) =>
  `${base(cloud, "image")}/c_fill,g_auto,w_176,h_176,f_auto,q_auto/${id}`;

// Imagen principal 4:3.
export const heroUrl = (cloud: string, id: string) =>
  `${base(cloud, "image")}/c_fill,g_auto,ar_4:3,w_1000,f_auto,q_auto/${id}`;

export const videoUrl = (cloud: string, id: string) =>
  `${base(cloud, "video")}/q_auto,w_1280/${id}.mp4`;

export const videoPosterUrl = (cloud: string, id: string) =>
  `${base(cloud, "video")}/so_0,c_fill,g_auto,ar_16:9,w_1280,f_auto,q_auto/${id}.jpg`;
