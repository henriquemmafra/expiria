# Expiria

Aplicativo web para leitura e interpretação assistida de espirometrias. Versão inicial para validação médica.

## Recursos
- Upload de PDF (até 10 páginas), PNG, JPG, WEBP ou TXT, até 20 MB.
- Colar imagem ou texto; PDF digital com extração nativa, PDF escaneado e imagens com OCR Tesseract no navegador.
- Tabelas com cabeçalhos reconhecidos ou ordem de colunas selecionada pelo usuário; preenchimento manual quando ambíguas.
- Conferência obrigatória dos dados, cálculo VEF1/CVF, interpretação por LIN e resposta broncodilatadora SBPT 2024 (≥7% com basal alterado, ≥10% com basal normal), com comparação ERS/ATS 2022 (>10%).
- Sugestão editável, copiar, baixar TXT, imprimir/salvar PDF pelo navegador.

## Limitações
Não é um dispositivo médico validado. Não analisa curvas nem verifica aceitabilidade/repetibilidade automaticamente. Não calcula equações de referência, não confirma restrição ou distúrbio misto sem volumes pulmonares, não estabelece diagnóstico etiológico e não gradua gravidade. OCR pode errar, sobretudo em tabelas complexas. Todos os campos devem ser conferidos no original.

## Privacidade
Documentos e valores permanecem na memória da aba; nenhum exame é enviado a um backend ou persistido. Fontes web podem ser solicitadas ao Google, sem conteúdo do exame. Bibliotecas OCR/PDF e modelo de idioma são servidos com o aplicativo. Recarregar a página elimina o exame. Exportações são responsabilidade do usuário.

## Desenvolvimento
Node.js 22 ou superior. `npm ci`, `npm test`. `npm run build` atualiza as bibliotecas locais. `npm run build` baixa o modelo OCR quando ausente e copia as bibliotecas para dist/vendor. Sirva `dist` com qualquer servidor HTTP estático; não abra index.html via file://.

Testes: `npm test` (motor clínico e interpretação de tabelas). Arquivos de produção em `dist/`. Sem chave de API.

Referência: Stanojevic et al. ERS/ATS technical standard on interpretive strategies for routine lung function tests (2022), https://doi.org/10.1183/13993003.01499-2021.

Fonte principal: SBPT 2024, https://doi.org/10.36416/1806-3756/e20240169. A hierarquia é brasileira, europeia/conjunta e complementar. Consulte docs/BIBLIOGRAFIA.md.
