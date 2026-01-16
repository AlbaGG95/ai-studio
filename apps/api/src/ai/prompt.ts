export function buildPresetPrompt(
  userPrompt: string,
  errors?: string[]
): string {
  const header = [
    "Genera un Preset v1 de AI Studio como JSON valido.",
    "Reglas:",
    "- Responde solo JSON, sin markdown ni texto extra.",
    "- No incluyas comentarios ni codigo.",
    "- Debe cumplir el contrato Preset v1.",
    "",
    "Estructura requerida:",
    "{",
    "  \"meta\": {",
    "    \"name\": \"string\",",
    "    \"version\": \"0.1.0\",",
    "    \"language\": \"es|en\",",
    "    \"templateId\": \"idle-rpg-base@1.2\"",
    "  },",
    "  \"tuning\": {",
    "    \"pacing\": \"slow|normal|fast\",",
    "    \"difficulty\": \"easy|normal|hard\",",
    "    \"economy\": \"stingy|normal|generous\",",
    "    \"inventoryEnabled\": true|false,",
    "    \"damageFormula\": \"linear|scaling|exponential\",",
    "    \"progressionScaling\": \"linear|quadratic|exponential\",",
    "    \"levels\": 10-200",
    "  },",
    "  \"seed\": \"opcional\"",
    "}",
    "",
    "Ejemplo valido:",
    "{",
    "  \"meta\": {",
    "    \"name\": \"Preset Demo\",",
    "    \"version\": \"0.1.0\",",
    "    \"language\": \"es\",",
    "    \"templateId\": \"idle-rpg-base@1.2\"",
    "  },",
    "  \"tuning\": {",
    "    \"pacing\": \"normal\",",
    "    \"difficulty\": \"normal\",",
    "    \"economy\": \"normal\",",
    "    \"inventoryEnabled\": false,",
    "    \"damageFormula\": \"linear\",",
    "    \"progressionScaling\": \"linear\",",
    "    \"levels\": 20",
    "  }",
    "}",
    "",
    `Prompt del usuario: ${userPrompt}`,
  ];

  if (errors && errors.length > 0) {
    header.push(
      "",
      "Errores de validacion anteriores:",
      errors.map((err) => `- ${err}`).join("\n"),
      "Corrige el JSON y responde solo con JSON valido."
    );
  }

  return header.join("\n");
}
