import { Link, Route, Routes } from "react-router";
import { EDITABLE_PAGES } from "./pages";
import { SitePageEditor } from "./SitePageEditor";

/** Admin Pages: the list of editable site pages, and each page's editor. */
export function SitePagesPage() {
  return (
    <Routes>
      <Route index element={<PageList />} />
      <Route path=":slug" element={<SitePageEditor />} />
    </Routes>
  );
}

function PageList() {
  return (
    <section className="kc-site-page">
      <h1>Pages</h1>
      <ul className="kc-site-page__list">
        {EDITABLE_PAGES.map((p) => (
          <li key={p.slug}>
            <Link to={`/pages/${p.slug}`} className="kc-site-page__link">
              <strong>{p.title}</strong>
              <span>{p.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
