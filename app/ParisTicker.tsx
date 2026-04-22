/** Bandeau défilant — contenu dupliqué pour boucle CSS seamless. */
export function ParisTicker() {
  const segment = (
    <>
      <span>POSTE DISPONIBLE · </span>
      <span className="rs-ticker__accent">TEE EN STOCK</span>
      <span> · CANDIDATURE OUVERTE · DÉPOSE TON CV · </span>
      <span className="rs-ticker__accent">SWIPE LES PROFILS</span>
      <span> · </span>
      <span className="rs-ticker__accent">REJOINS LE COLLECTIF</span>
      <span> · CDD · CDI · </span>
      <span className="rs-ticker__accent">TEE-SHIRT</span>
      <span> · À TOI DE CHOISIR · </span>
      <span className="rs-ticker__accent">LES MEILLEURS FINISSENT SUR LE PACKAGING</span>
      <span> · </span>
    </>
  );

  return (
    <div className="rs-ticker" aria-hidden="true">
      <div className="rs-ticker__viewport">
        <div className="rs-ticker__track">
          <div className="rs-ticker__group">{segment}</div>
          <div className="rs-ticker__group">{segment}</div>
        </div>
      </div>
    </div>
  );
}
