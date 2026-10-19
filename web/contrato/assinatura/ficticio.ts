import type { Termo } from './formato'
import { paraQuadro, type Ponto } from './traco'

export const TEXTO_FICTICIO = `# Termo de consentimento para atendimento fonoaudiológico

Eu, responsável pelo(a) paciente **Ana Beatriz Fictícia**, nascida em 04/03/2019, autorizo a Clínica Exemplo e a fonoaudióloga Fernanda Exemplo (CRFa 5-00000) a realizar avaliação e atendimento fonoaudiológico.

## 1. Do atendimento

Fui informado(a) de que o atendimento compreende:
- avaliação, com entrevista e testes adequados à idade;
- terapia, em sessões com dia e horário combinados;
- orientações à família e, quando combinado, à escola.

Os resultados dependem da **frequência** e da participação da família.

## 2. Dos dados pessoais e de saúde

Autorizo o registro e a guarda dos dados de identificação, de contato e de saúde do(a) paciente e dos responsáveis, em meio eletrônico, pelo tempo exigido para o prontuário, exclusivamente para o atendimento, a comunicação com a família e o cumprimento de obrigações legais.

## 3. Dos direitos

Posso a qualquer momento pedir acesso, correção ou informações sobre o uso dos dados e revogar este consentimento, sem prejuízo do que já foi feito com base nele.

## 4. Das faltas e desmarcações

Desmarcações devem ser avisadas com pelo menos **24 horas** de antecedência. Faltas sem aviso podem ser cobradas conforme o combinado no contrato.

## 5. Da assinatura eletrônica

Declaro que li este termo, que tenho direito de consentir pelo(a) paciente e que aceito a assinatura eletrônica feita no meu celular, com meu nome, CPF e assinatura desenhada, como forma válida de manifestar minha concordância, nos termos do art. 10, § 2º, da Medida Provisória 2.200-2/2001.`

export const ID_FICTICIO = 'AAECAwQFBgcICQoLDA0ODw'
export const CPF_FICTICIO = '12345678909'

export function termoFicticio(mudancas: Partial<Termo> = {}): Termo {
  return {
    id: ID_FICTICIO,
    ate: Math.floor(Date.UTC(2026, 9, 25, 3) / 1000),
    cli: { nome: 'Clínica Exemplo', whats: '5565999990000' },
    pac: { nome: 'Ana Beatriz Fictícia', nasc: '2019-03-04' },
    resp: { papel: 'mae' },
    mod: { titulo: 'Termo de consentimento', versao: 3 },
    prof: { nome: 'Fernanda Exemplo', reg: 'CRFa 5-00000' },
    txt: TEXTO_FICTICIO,
    ...mudancas
  }
}

function sorteio(semente: number): () => number {
  let estado = semente
  return () => {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function assinaturaFicticia(tracos = 4, amostras = 400, voltas = 10): Ponto[][] {
  const aleatorio = sorteio(7)
  return Array.from({ length: tracos }, (_, t) => {
    const fase = aleatorio() * Math.PI * 2
    const inicio = 40 + (t * 920) / tracos
    return Array.from({ length: amostras }, (_, i) => {
      const p = i / (amostras - 1)
      const x = inicio + (p * 920) / tracos + 22 * Math.sin(p * voltas * 2 + fase)
      const y = 200 + 120 * Math.sin(p * voltas + fase) * Math.cos(p * 3) + (aleatorio() - 0.5) * 2
      return paraQuadro(x, y, 1000, 400)
    })
  })
}
