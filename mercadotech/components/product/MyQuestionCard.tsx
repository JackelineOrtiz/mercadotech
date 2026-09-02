import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { Badge } from "@/components/ui/badge";
import type { MyQuestion } from "@/types/question";

export interface MyQuestionCardProps {
  question: MyQuestion;
}

// Fase 7.5, hallazgo real: sección nueva para que un comprador vea las
// preguntas que ÉL hizo, a través de todos los productos. El título
// navega a la ficha real del producto (a diferencia de
// vendedor/preguntas, que abre un preview — acá SÍ tiene sentido navegar:
// un comprador puede querer comprarlo desde ahí).
export function MyQuestionCard({ question }: MyQuestionCardProps) {
  return (
    <li className="flex gap-4 rounded-lg border border-border p-4">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
        <ProductImage src={question.productImageUrl} alt={question.productTitle} sizes="64px" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/producto/${question.product_id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {question.productTitle}
          </Link>
          <Badge variant={question.answer ? "secondary" : "outline"}>
            {question.answer ? "Respondida" : "Pendiente"}
          </Badge>
        </div>
        <p className="text-sm">
          <span className="font-medium">Tu pregunta:</span> {question.question}
        </p>
        {question.answer ? (
          <p className="text-sm">
            <span className="font-medium">Respuesta del vendedor:</span> {question.answer}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no tiene respuesta del vendedor.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {new Date(question.created_at).toLocaleDateString("es-CO")}
        </p>
      </div>
    </li>
  );
}
