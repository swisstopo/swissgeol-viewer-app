// A central error facility we can improve later
export function appError(msg) {
  console.error('NGM-error', msg);
}

export async function readTextFile(url) {
  const response = await fetch(url);
  try {
    return await response.text();
  } catch (e) {
    console.warn(e);
  }
}
