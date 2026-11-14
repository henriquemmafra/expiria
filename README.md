# Expiria

**Análises da função pulmonar.** Identidade visual em azul-petróleo, turquesa e verde-menta, com símbolo vetorial de fluxo respiratório.

Aplicativo web para interpretação assistida de espirometria, volumes pulmonares, DLCO e resistência das vias aéreas. **Versão experimental que requer validação médica.**

## Recursos
- Upload de PDF (até 10 páginas), PNG, JPG, WEBP ou TXT, até 20 MB.
- Colar imagem ou texto; PDF digital com extração nativa, PDF escaneado e imagens com OCR Tesseract no navegador.
- **Colar o laudo inteiro**: um único parser (`dist/parser.mjs`) lê espirometria, volumes, DLCO, resistência/oscilometria e os dados do paciente (sexo, idade ou nascimento, estatura, peso, Hb, data), além do método (pletismografia/diluição, unidade da DLCO, DLCO corrigida). A leitura é automática ao colar e os campos preenchidos ficam destacados para conferência.
- Cabeçalhos flexíveis (Pré/Pós-BD, Medido, Atual, Best, Pred, LLN, %Prev, Z-score, Var%, cabeçalho em duas linhas), células vazias, tabelas com tab/pipe/ponto e vírgula, marcadores `*`, unidades `(L)`/`[L]`/mL e erros comuns de OCR. Linhas sem cabeçalho reconhecido nunca são adivinhadas: são listadas no status.
- Conferência obrigatória dos dados, cálculo VEF1/CVF, interpretação por LIN e resposta broncodilatadora SBPT 2024 (≥7% com basal alterado, ≥10% com basal normal), com comparação ERS/ATS 2022 (>10%).
- Volumes pulmonares por pletismografia com equações brasileiras de Lessa et al. 2021: CPT, VR, VR/CPT, CRF, CI, VRE e CV (com restrições de idade, estatura, IMC e método).
- Difusão por monóxido de carbono (DLCO, VA, KCO) com equações **da tabela original** Guimarães et al. 2019; opção de ajustar o previsto por hemoglobina segundo ERS/ATS e converter SI/tradicional.
- Resistência por pletismografia (Raw, sRaw, Gaw e sGaw) e oscilometria (R5, R20, R5–R20, X5, AX e Fres), com interpretação por limites fornecidos pelo laboratório; nenhuma equação de resistência é presumida.
- Sugestão de laudo único integrada aos módulos presentes, com alertas de dados contraditórios e aviso de referências incompletas.
- **Previsto e LIN calculados quando o exame não traz**: espirometria por Pereira et al. 2007 (J Bras Pneumol 33:397; adultos brancos, sem extrapolar fora da amostra), volumes por Lessa 2021 e DLCO por Guimarães 2019, a partir de sexo, idade e estatura lidos do texto. Os campos calculados ficam verdes com a fonte no tooltip, nunca sobrescrevem valores do exame ou digitados, e o laudo informa a equação usada.
- **Fotografar o exame pelo celular**: botão de câmera (aparece em telas de toque) com pré-processamento da imagem (escala, tons de cinza, contraste) antes do OCR. O parser reconstrói vírgulas decimais perdidas pela faixa plausível de cada parâmetro e avisa quais campos foram reconstruídos; linhas incoerentes (LIN acima do previsto, números colados) são recusadas e listadas, nunca preenchidas.
- **Gráfico de resultados** em % do previsto, com faixa LIN–LSN e marcadores pré/pós-BD para espirometria, volumes, DLCO e resistência; incluído na impressão. Não reconstrói curvas fluxo-volume/volume-tempo, que dependem do sinal bruto do equipamento.
- Sugestão editável, copiar, baixar TXT, imprimir/salvar PDF pelo navegador.

## Limitações
Não é um dispositivo médico validado. Não analisa curvas nem verifica aceitabilidade/repetibilidade automaticamente. Calcula equações brasileiras apenas na faixa e método da amostra, sem extrapolar. A confirmação de restrição exige CPT válida; distúrbio misto exige também obstrução espirométrica. Resistência só é classificada quando limites confiáveis são informados. A interpretação da DLCO depende de qualidade técnica, Hb e método e não estabelece etiologia. OCR pode errar e as tabelas complementares só são extraídas com cabeçalho inequívoco. Todos os campos devem ser conferidos no original; não substitui laudo por médico.

## Privacidade
Documentos e valores permanecem na memória da aba; nenhum exame é enviado a um backend ou persistido. Fontes web podem ser solicitadas ao Google, sem conteúdo do exame. Bibliotecas OCR/PDF e modelo de idioma são servidos com o aplicativo. Recarregar a página elimina o exame. Exportações são responsabilidade do usuário.

## Desenvolvimento
Node.js 22 ou superior. `npm ci`, `npm test`. `npm run build` atualiza as bibliotecas locais. `npm run build` baixa o modelo OCR quando ausente e copia as bibliotecas para dist/vendor. Sirva `dist` com qualquer servidor HTTP estático; não abra index.html via file://.

Testes: `npm test` (motor clínico e interpretação de tabelas). Arquivos de produção em `dist/`. Sem chave de API.

Referências: Lessa et al., J Bras Pneumol 2021 (https://doi.org/10.36416/1806-3756/e20200359); Guimarães et al., J Bras Pneumol 2019 (https://doi.org/10.1590/1806-3713/e20180262); ERS/ATS 2017 DLCO (https://doi.org/10.1183/13993003.00016-2016); Stanojevic et al. ERS/ATS 2022 (https://doi.org/10.1183/13993003.01499-2021).

Fonte principal: SBPT 2024, https://doi.org/10.36416/1806-3756/e20240169. A hierarquia é brasileira, europeia/conjunta e complementar. Consulte docs/BIBLIOGRAFIA.md.

## Status de validação (13/11/2026)
Código de implementação e testes de regressão incluídos em `dist/full-function.mjs`, `dist/full-ui.mjs` e `tests/full-function.test.mjs`. A análise matemática não equivale à validação clínica nem certificação regulatória. Conferir resultados com o artigo original e casos desidentificados sob supervisão médica, inclusive correção de Hb. As equações da página resumo da SPPT e da tabela original da publicação de DLCO divergem; o módulo segue o **artigo primário**, documentado abaixo. A constante masculina de CI também apresenta divergência de sinal entre o artigo e a página SPPT; requer conferência antes de uso clínico.
