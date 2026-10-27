import { buildImovelwebFeed } from "../lib/imovelweb/feed";
import { property, feedConfig } from "./fixtures/property.mjs";
import type { Property } from "../lib/types";

process.stdout.write(
  buildImovelwebFeed(
    [
      property({
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
    ],
    feedConfig,
    1793100000000,
  ),
);
