import { buildImovelwebFeed } from "../lib/imovelweb/feed";
import { property, feedConfig } from "./fixtures/property.mjs";
import type { Property } from "../lib/types";

process.stdout.write(
  buildImovelwebFeed(
    [
      property({
        // Exercita o limite de 80 caracteres Unicode, que ocupam 160 unidades UTF-16.
        title: "🏡".repeat(80),
        description:
          "Descrição com acentos, & e <símbolos>, incluindo ]]> como texto. ".repeat(
            2,
          ),
      }) as Property,
      property({
        id: "21fa6fab-3b0c-430a-9767-70a3ab1c4584",
        code: "MV-ALUGUEL",
        transaction_type: "aluguel",
      }) as Property,
      property({
        // Anúncio fictício: título curto e área construída ausente, com CEP obrigatório.
        id: "92fa6f18-7f50-47c9-bc19-1b6cc93488ee",
        code: "MV-TESTE-SEM-AREA",
        type: "casa",
        title: "Casa",
        zip_code: "54400-000",
        covered_area_m2: null,
      }) as Property,
    ],
    feedConfig,
    1793100000000,
  ),
);
