import { describe, expect, it } from "vitest";
import { absoluteUrl, capsuleJsonLd, escapeXml, renderRobots, renderRss, renderSitemap, rfc822, siteOrigin, sitemapEntries, staticPaths, truncate } from "./seo";

const origin = "https://example.org";

describe("urls", () => {
  it("builds one canonical per path", () => {
    expect(absoluteUrl(origin + "/", "/")).toBe("https://example.org/");
    expect(absoluteUrl(origin, "/blog/?page=2#x")).toBe("https://example.org/blog");
    expect(siteOrigin(undefined, "http://localhost:4321/")).toBe("http://localhost:4321");
    expect(siteOrigin("https://site.org/", "http://x")).toBe("https://site.org");
    expect(() => siteOrigin(undefined, "https://evil.test", true)).toThrow(/PUBLIC_SITE_URL/);
    expect(siteOrigin("https://site.org", "https://evil.test", true)).toBe("https://site.org");
  });
  it("escapes XML and truncates at words", () => {
    expect(escapeXml(`a&b <c> "d"`)).toBe("a&amp;b &lt;c&gt; &quot;d&quot;");
    expect(truncate("short")).toBe("short");
    const t = truncate("word ".repeat(80), 40);
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t.endsWith("…")).toBe(true);
  });
});

describe("sitemap", () => {
  const src = {
    capsules: [{ slug: "grace-1", displayDate: "2026-11-01" }, { slug: "grace-1", displayDate: "2026-11-01" }],
    series: [{ slug: "grace", lastDate: "2026-11-01" }],
    posts: [{ slug: "hello", date: "2026-10-01" }],
    events: [{ slug: "conf", startsAt: "2026-12-05T09:00:00Z" }],
  };
  it("lists every public URL once", () => {
    const paths = sitemapEntries(src).map((e) => e.path);
    for (const p of [...staticPaths, "/capsules/grace-1", "/series/grace", "/blog/hello", "/events/conf"]) expect(paths).toContain(p);
    expect(new Set(paths).size).toBe(paths.length);
  });
  it("renders valid urlset XML with lastmod", () => {
    const xml = renderSitemap(origin, sitemapEntries(src));
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<url><loc>https://example.org/capsules/grace-1</loc><lastmod>2026-11-01</lastmod></url>");
    expect(xml).toContain("<loc>https://example.org/events/conf</loc><lastmod>2026-12-05</lastmod>");
  });
  it("points robots.txt at the sitemap", () => {
    expect(renderRobots(origin)).toContain("Sitemap: https://example.org/sitemap.xml");
  });
});

describe("rss", () => {
  it("renders an RSS 2.0 feed with escaped items", () => {
    const xml = renderRss(origin, { title: "T & Co", description: "d", selfPath: "/rss.xml", homePath: "/capsules" }, [{ title: "A <b>", path: "/capsules/a", date: "2026-11-02", description: "x & y" }]);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<title>T &amp; Co</title>");
    expect(xml).toContain('<atom:link href="https://example.org/rss.xml" rel="self" type="application/rss+xml" />');
    expect(xml).toContain("<title>A &lt;b&gt;</title>");
    expect(xml).toContain('<guid isPermaLink="true">https://example.org/capsules/a</guid>');
    expect(xml).toContain(`<pubDate>${rfc822("2026-11-02")}</pubDate>`);
    expect(rfc822("2026-11-02")).toBe("Mon, 02 Nov 2026 12:00:00 GMT");
  });
});

describe("json-ld", () => {
  it("describes a capsule as an Article", () => {
    const ld = capsuleJsonLd({ slug: "a", title: "A", displayDate: "2026-11-02", scriptureRef: "John 1:1" }, origin) as Record<string, unknown>;
    expect(ld["@type"]).toBe("Article");
    expect(ld.mainEntityOfPage).toBe("https://example.org/capsules/a");
  });
});
