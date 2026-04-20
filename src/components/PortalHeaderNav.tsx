import Link from "next/link";

/** Onglets portail : l’onglet actif suit `data-rs-header-tab` (posé par RouteHtmlDataset). */
export function PortalHeaderNav() {
  return (
    <div className="rs-header-tabstrip">
      <nav
        className="rs-banner-nav rs-header-pole-tabs"
        aria-label="Navigation principale"
      >
        <ul className="rs-subnav rs-subnav--buttons" role="menubar">
          <li className="rs-subnav__item" data-rs-tab="offres">
            <button type="button" className="rs-subnav__trigger">
              Offres
            </button>
            <ul className="rs-subnav__dropdown">
              <li>
                <a href="https://recrutestagiaire.eu/collections/abcdrs">
                  Collection ABCDRS
                </a>
              </li>
              <li>
                <a href="https://recrutestagiaire.eu/collections/les-stagiaires-de-base">
                  Les stagiaires de base
                </a>
              </li>
            </ul>
          </li>

          <li className="rs-subnav__item" data-rs-tab="cand">
            <button type="button" className="rs-subnav__trigger">
              Candidatures
            </button>
            <ul className="rs-subnav__dropdown">
              <li>
                <Link href="/profils">Profils candidats</Link>
              </li>
              <li>
                <Link href="/depot">Déposer sa candidature</Link>
              </li>
              <li>
                <Link href="/swipe">Vote (swipe)</Link>
              </li>
            </ul>
          </li>

          <li className="rs-subnav__item" data-rs-tab="coll">
            <button type="button" className="rs-subnav__trigger">
              Le collectif
            </button>
            <ul className="rs-subnav__dropdown">
              <li>
                <a href="https://recrutestagiaire.eu/pages/about">Histoire</a>
              </li>
              <li>
                <a href="https://recrutestagiaire.eu/pages/contact">Contact</a>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}
