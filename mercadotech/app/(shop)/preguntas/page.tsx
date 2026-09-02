"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useMyQuestions } from "@/hooks/useMyQuestions";
import { MyQuestionCard } from "@/components/product/MyQuestionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";

// Fase 7.5, hallazgo real: no existía ningún lugar donde un comprador
// pudiera ver las preguntas que ÉL había hecho — había que recordar en
// qué producto se preguntó y volver a esa ficha para ver si ya tenía
// respuesta. Mismo criterio de página que /pedidos (protegida por
// middleware, sin guard propio).
export default function PreguntasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { questions, loading, error, retry } = useMyQuestions(user?.id);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Mis preguntas</h1>
      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <ErrorState onRetry={retry} />
      ) : questions.length === 0 ? (
        <EmptyState
          title="Todavía no has hecho ninguna pregunta"
          description="Cuando le preguntes algo a un vendedor sobre un producto, va a aparecer acá."
          action={<Button onClick={() => router.push("/")}>Explorar productos</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {questions.map((question) => (
            <MyQuestionCard key={question.id} question={question} />
          ))}
        </ul>
      )}
    </div>
  );
}
