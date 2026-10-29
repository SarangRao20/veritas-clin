export async function parseApiResponse(response, path) {
  if (response.status === 204) return null;

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Expected a JSON response from ${path}. Check that the API server and API base URL are correct.`);
  }

  if (!response.ok) {
    throw new Error(body?.detail ?? `${response.status} ${response.statusText}`);
  }
  return body;
}
