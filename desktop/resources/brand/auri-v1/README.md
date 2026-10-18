# Auri — proposta de marca v1

O símbolo combina um “a” orgânico com uma referência abstrata à escuta. Na assinatura, ele ocupa o lugar da primeira letra do nome e se une a “uri”, com proporções e alinhamento ajustados. O desenho usa uma silhueta contínua e espaços internos abertos para preservar a leitura em tamanhos pequenos. As letras são desenhadas em vetor, em minúsculas.

## Arquivos

- `auri-grafite.svg` / `auri-branco.svg`: assinatura horizontal, em vetor, com fundo transparente e letras convertidas em caminhos. Não depende de uma fonte instalada.
- `auri-grafite.png` / `auri-branco.png`: assinatura horizontal a 1608 × 708 pixels, com transparência.
- `simbolo-grafite.svg` / `simbolo-branco.svg`: símbolo isolado em vetor, com transparência.
- `simbolo-grafite.png` / `simbolo-branco.png`: símbolo isolado a 576 × 544 pixels, com transparência.
- `auri-app.svg` / `auri-app.png`: ícone do aplicativo a 1024 × 1024 pixels, com quadrado grafite, cantos contínuos, margem transparente, contorno e profundidade discreta para acompanhar a escala dos outros ícones do Dock.
- `apresentacao.png`: apresentação da marca em fundos claro e escuro, com exemplos do símbolo em tamanhos menores.
- `preview-icone.png`: acabamento do ícone em fundos claro e escuro.
- `preview-assinatura.png`: assinatura em branco, com o símbolo formando o “a” de Auri.
- `preview.html`: apresentação local para inspeção.
- `prompts.txt`: instruções usadas na exploração com a ferramenta integrada `imagegen`.

## Uso

Use grafite `#1B1B22` sobre fundos claros e branco `#FFFFFF` sobre o grafite. Preserve as proporções e a margem presente nos arquivos. Prefira o SVG para interfaces e ampliação. O símbolo foi inspecionado a 24, 40 e 64 pixels na apresentação.

No ícone do aplicativo, o quadrado ocupa 824px do canvas de 1024px, com 100px de margem por lado. O símbolo centralizado ocupa aproximadamente 530px de largura, deixando espaço ao redor. O fundo varia discretamente de `#303039` a `#17171D`; o contorno iluminado e a sombra definem a borda sobre o Dock escuro.

## Produção

A direção inicial foi explorada com a ferramenta integrada `imagegen`. A versão final foi redesenhada manualmente em SVG para ter preenchimentos uniformes, curvas limpas e a mesma geometria nas versões grafite e branca. Os PNGs foram renderizados a partir dos SVGs finais.
