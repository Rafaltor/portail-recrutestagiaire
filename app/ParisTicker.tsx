/** Bandeau défilant — aligné sur `sections/header.liquid` (thème recrutestagiaire). */
export function ParisTicker() {
  const group = (
    <>
      <span className="rs-ticker__accent">CANDIDATURE OUVERTE</span>
      <span className="rs-ticker__sep">✦</span>
      <span>DÉPOSE TON CV</span>
      <span className="rs-ticker__sep">✦</span>
      <span>SWIPE LES PROFILS</span>
      <span className="rs-ticker__sep">✦</span>
      <span>REJOINS LE COLLECTIF</span>
      <span className="rs-ticker__sep">✦</span>
      <span className="rs-ticker__accent">LES MEILLEURS FINISSENT SUR LE PACKAGING</span>
      <span className="rs-ticker__sep">✦</span>
    </>
  );

  return (
    <div className="rs-ticker" aria-hidden="true">
      <div className="rs-ticker__viewport">
        <div className="rs-ticker__track">
          <div className="rs-ticker__group">{group}</div>
          <div className="rs-ticker__group" aria-hidden="true">
            {group}
          </div>
        </div>
      </div>
    </div>
  );
}
