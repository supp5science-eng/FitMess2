import type { Metadata } from "next";

import { Klon3DView } from "./klon-3d-view";

/**
 * `/admin/klon3d` -- the klon as a figure you can turn.
 *
 * A LOOK, not a feature. On 24.08.2026 the klon was drawn as four orthographic
 * views in one image (front / profile / back / profile), those four were fed to
 * an image-to-3D service, and this page is where the resulting mesh gets
 * judged on a phone instead of in a description. Both meshes come from one
 * person's twelve photos; nothing here is per-user and nothing is stored.
 *
 * Two models on purpose: the textured one is what a user would see, the bare
 * geometry shows what the reconstruction actually understood about the body --
 * texture hides a bad silhouette surprisingly well.
 *
 * `/admin/layout.tsx` already locks the whole section to `profiles.is_admin`.
 */
export const metadata: Metadata = {
  title: "Klon 3D",
};

/**
 * Where the meshes live.
 *
 * Deliberately NOT in `public/`: together they are 8.5MB, and a repo that
 * carries a throwaway probe of one person's body in git forever is a bad
 * trade. They sit where the generator put them, and this page dies with them
 * -- which is correct, because the probe is finished either way.
 */
const MODELS = [
  {
    label: "Sa teksturom",
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_2zoYLuEoV1R6BpeW06NkoBhaUPf/hf_20260824_203349_c04e6803-d4a9-4a23-8fbf-678a738706fe.glb",
  },
  {
    label: "Gola geometrija",
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_2zoYLuEoV1R6BpeW06NkoBhaUPf/hf_20260824_203338_59262e95-9302-4118-9d0a-a879beef2bfe.glb",
  },
];

export default function Klon3DPage() {
  return (
    <div className="flex flex-col gap-4 px-5 pb-10 pt-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Klon 3D
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Proba: četiri nacrtana pogleda pretvorena u model. Okreni ga prstom.
        </p>
      </div>
      <Klon3DView models={MODELS} />
    </div>
  );
}
