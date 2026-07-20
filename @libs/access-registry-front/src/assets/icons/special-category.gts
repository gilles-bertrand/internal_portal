import type { TOC } from '@ember/component/template-only';

// heroicons "shield-exclamation" — marque les enregistrements portant des
// données sensibles (catégorie spéciale, art. 9 RGPD).
const SpecialCategoryIcon: TOC<{ Element: SVGSVGElement }> = <template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    ...attributes
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 9v3.75m0 0a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9.75c0-1.153.26-2.243.723-3.218a11.955 11.955 0 0 1 8.277-3.282 11.955 11.955 0 0 1 8.277 3.282c.463.975.723 2.065.723 3.218a12.02 12.02 0 0 0-.382 3.016A11.955 11.955 0 0 1 12 12.75Zm0 3.75h.008v.008H12v-.008Z"
    />
  </svg>
</template>;

export default SpecialCategoryIcon;
