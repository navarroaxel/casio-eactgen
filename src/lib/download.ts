/** Trigger a browser download of `data` as `name`. */
export function downloadBlob(
  name: string,
  data: ArrayBuffer | string,
  mime: string,
) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
