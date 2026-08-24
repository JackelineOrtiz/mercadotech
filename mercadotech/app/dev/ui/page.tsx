"use client";

import { useState } from "react";
import { Price } from "@/components/shared/Price";
import { RatingStars } from "@/components/shared/RatingStars";
import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { ProductImage } from "@/components/shared/ProductImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductCondition } from "@/lib/constants/roles";

const CONDITIONS: ProductCondition[] = ["nuevo", "usado", "reacondicionado"];

// Página de muestra de la Fase 3.1 — se borra en la Fase 3.8. No hace
// fetching ni conoce Supabase: todos los valores de abajo son fijos.
export default function DevUiPage() {
  const [dark, setDark] = useState(false);
  const [interactiveRating, setInteractiveRating] = useState(3);

  function toggleTheme() {
    document.documentElement.classList.toggle("dark");
    setDark((d) => !d);
  }

  return (
    <div className="min-h-screen bg-background py-10 text-foreground">
      <Container className="flex flex-col gap-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Sistema visual — componentes base (Fase 3.1)
          </h1>
          <Button onClick={toggleTheme} variant="outline">
            Cambiar a tema {dark ? "claro" : "oscuro"}
          </Button>
        </div>

        <Section title="Price">
          <div className="flex flex-wrap items-end gap-6">
            <Price value={1299.9} size="sm" />
            <Price value={"219.00"} size="md" />
            <Price value={2899.0} size="lg" />
          </div>
        </Section>

        <Section title="RatingStars">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-32">Solo lectura</span>
              <RatingStars value={4} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-32">Editable</span>
              <RatingStars value={interactiveRating} onChange={setInteractiveRating} />
              <span className="text-sm text-muted-foreground">
                ({interactiveRating}/5)
              </span>
            </div>
          </div>
        </Section>

        <Section title="ConditionBadge">
          <div className="flex flex-wrap gap-3">
            {CONDITIONS.map((c) => (
              <ConditionBadge key={c} condition={c} />
            ))}
          </div>
        </Section>

        <Section title="ProductImage (con placeholder si falla)">
          <div className="flex flex-wrap gap-4">
            <div className="relative size-32 overflow-hidden rounded-lg border border-border">
              <ProductImage src="/next.svg" alt="Imagen que sí carga" />
            </div>
            <div className="relative size-32 overflow-hidden rounded-lg border border-border">
              {/* Path real de Storage que no existe (gap conocido del seed,
                  Fase 2.5): demuestra el 404 real, no uno simulado. */}
              <ProductImage
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/no-existe.jpg`}
                alt="Producto cuya imagen no existe en Storage (placeholder)"
              />
            </div>
            <div className="relative size-32 overflow-hidden rounded-lg border border-border">
              <ProductImage src={null} alt="Producto sin imagen (placeholder)" />
            </div>
          </div>
        </Section>

        <Section title="EmptyState">
          <EmptyState
            title="Tu carrito está vacío"
            description="Agrega productos para verlos aquí."
            action={<Button>Explorar productos</Button>}
          />
        </Section>

        <Section title="ErrorState">
          <ErrorState onRetry={() => alert("Reintentando…")} />
        </Section>

        <Section title="LoadingState">
          <LoadingState rows={3} />
        </Section>

        <Section title="Card + Button (referencia del sistema visual)">
          <div className="flex flex-wrap gap-4">
            <Card className="w-64">
              <CardHeader>
                <CardTitle>Producto de ejemplo</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <ConditionBadge condition="nuevo" />
                <Price value={1399} size="lg" />
                <Button className="w-full">Agregar al carrito</Button>
              </CardContent>
            </Card>
            <div className="flex flex-wrap items-start gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </div>
        </Section>
      </Container>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}
