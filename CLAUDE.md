@AGENTS.md

## Claude Code

- As skills do projeto ficam em `.claude/skills/` (cópias geradas pelo `npx skills`; atualize repetindo o `npx skills add` de cada uma com `--agent claude-code --copy`, como em [docs/setup.md](docs/setup.md#como-manter-e-repetir), nunca à mão).
- Superpowers e Ponytail são plugins. Numa sessão do Claude Code: `/plugin install superpowers@claude-plugins-official`; para o Ponytail, `/plugin marketplace add DietrichGebert/ponytail` e depois `/plugin install ponytail@ponytail`.
- O hook do RTK e o conector do Context7 são do usuário, não do repositório. Veja [docs/setup.md](docs/setup.md).
