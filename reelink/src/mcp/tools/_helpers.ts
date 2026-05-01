type StructuredToolResult<T> = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
};

export function jsonToolResult<T>(structuredContent: T): StructuredToolResult<T> {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export function textToolResult<T>(text: string, structuredContent: T): StructuredToolResult<T> {
  return {
    content: [{ type: "text", text }],
    structuredContent,
  };
}
