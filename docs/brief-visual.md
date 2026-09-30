# Brief visual: ORVA

**Projeto:** site de estudo (marca fictícia) · **Público:** quem compra joia autoral de prata, 28 a 50 anos · **Tom:** precisa, silenciosa, luminosa
**Ação principal:** conhecer a coleção e examinar uma peça de perto (a sacola é demonstração)

## Referências (por seção)
| Seção | Referência | O que aproveitar | O que NÃO copiar |
|---|---|---|---|
| Hero | Site de joias OYLA (vídeo de rede social, set/2026) | Título condensado em caixa alta sobre mídia clara; rolagem que desfaz o título | Marca, fotos e textos |
| Coleção | OYLA | Colunas com linhas de 1 px, produto pequeno sobre fundo neutro | Nomes e preços |
| Provador | Páginas de produto em arco (receita "coleção em arco" da site-premium) | Um item em destaque, os outros recuados; nome grande atrás | Pedestal e cores chapadas de lojas de bebida |
| Editorial | OYLA | Coluna esquerda fixa, números grandes à direita | Texto |

Especificação comum: grade de 3 colunas no desktop (as linhas do cabeçalho caem nas mesmas colunas dos produtos), respiro em múltiplos de 8 px (16/24/32/48/72), foco visível em 2 px grená com 3 px de afastamento, celular com colunas de 78vw na trilha.

## Paleta e tokens
```css
:root {
  --paper: #FBFBF9;   /* fundo: off-white frio, não branco puro */
  --ink: #1B1A19;     /* texto corrido */
  --garnet: #7B1426;  /* marca: logo, navegação, foco (com parcimônia) */
  --muted: #6E6B67;   /* texto secundário */
  --mist: #EFEEEB;    /* superfícies: fundo das fotos, campo da newsletter */
  --rule: #BDB9B3;    /* linhas finas */
  --font-display: "Instrument Serif", serif;
  --font-body: "Hanken Grotesk", sans-serif;
}
```

Contraste (`contraste.py`, WCAG 2.2):

| Texto / fundo | Razão | Veredito |
|---|---|---|
| ink / paper | 16,77:1 | passa |
| muted / paper | 5,12:1 | passa |
| garnet / paper | 10,29:1 | passa |
| muted / mist | 4,57:1 | passa (no limite; não usar muted menor que 13 px sobre mist) |
| #3C4448 / água clara #DDE4E7 | 7,73:1 | passa, mas o fundo animado tem cáusticas quase brancas: a legenda ganha um véu claro atrás |

## Tipografia
- Títulos: Instrument Serif 400, caixa alta só no hero · Texto: Hanken Grotesk 400/500
- Escala: 11 (rótulos) / 13 / 14 / 15 / 28 / 36–56 (h2) / 52–120 px (hero)

## Movimento
- Anima: título do hero (desfaz em blur), trilha da coleção, revelação da água, giro do provador, contadores.
- Não anima: textos do editorial, rodapé, entradas de seção por fade.
- Respeita `prefers-reduced-motion` (sem pin, sem Lenis, provador troca sem giro).

## Fundos e atmosfera
Luz de estúdio branca e prata; a única cor forte é a das pedras (rubi, esmalte azul, ônix). No provador, o fundo ganha um tom muito baixo da pedra em destaque.

## Proibições deste projeto
- Degradê roxo, orbs de luz, glassmorphism fora do cabeçalho, sombra em card.
- Inter, Geist, Space Grotesk; serifada em itálico.
- Três cards de benefício em fileira; ícones Lucide; emojis.
- Depoimentos, "clientes satisfeitos", números sem fonte. Os números do editorial são da marca fictícia e o site diz que ela é fictícia.
- Links mortos (`href="#"`) e redes sociais que não existem.
- Travessões no texto corrido; "não é X, é Y"; três adjetivos em sequência.
