/** Remove caracteres que o XML 1.0 não permite, sem perder pares Unicode válidos. */
export function xmlText(value: string | number): string {
  return Array.from(String(value))
    .filter((char) => {
      const cp = char.codePointAt(0)!;
      return (
        cp === 9 ||
        cp === 10 ||
        cp === 13 ||
        (cp >= 32 && cp <= 0xd7ff) ||
        (cp >= 0xe000 && cp <= 0xfffd) ||
        (cp >= 0x10000 && cp <= 0x10ffff)
      );
    })
    .join("");
}

// XSD mede caracteres Unicode, e não unidades UTF-16 de String.length.
export const xmlLength = (value: string) => Array.from(xmlText(value)).length;
export const xmlTag = (name: string, value: string | number) =>
  `<${name}><![CDATA[${xmlText(value).replace(/]]>/g, "]]]]><![CDATA[>")}]]></${name}>`;
