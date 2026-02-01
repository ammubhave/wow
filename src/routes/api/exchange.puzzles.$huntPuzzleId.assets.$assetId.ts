import {createFileRoute} from "@tanstack/react-router";
import {env, waitUntil} from "cloudflare:workers";

export const Route = createFileRoute("/api/exchange/puzzles/$huntPuzzleId/assets/$assetId")({
  server: {
    handlers: {
      GET: async ({request, params: {huntPuzzleId, assetId}}) => {
        const cacheKey = new Request(request.url.toString(), request);
        if (!("default" in caches)) throw new Error("Caches not available");
        const cache = caches.default as Cache;
        let response = await cache.match(cacheKey);
        if (response) {
          return response;
        }
        const object = await env.R2.get(`exchange/${huntPuzzleId}/${assetId}`);
        if (object === null) return new Response(null, {status: 404});
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.append("Cache-Control", "s-maxage=10");
        headers.append(
          "Content-Type",
          object.httpMetadata?.contentType || "application/octet-stream"
        );
        response = new Response(object.body, {headers});
        waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      },
    },
  },
});
