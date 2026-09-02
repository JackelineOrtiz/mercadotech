"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProduct } from "@/hooks/useProduct";
import { useSellerPublicProfile } from "@/hooks/useSellerPublicProfile";
import { useQuestions } from "@/hooks/useQuestions";
import { useReviews } from "@/hooks/useReviews";
import { useFavorite } from "@/hooks/useFavorite";
import { useCart } from "@/hooks/useCart";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { BuyBox } from "@/components/product/BuyBox";
import { QuestionsSection } from "@/components/product/QuestionsSection";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

// Antes vivía todo esto en page.tsx. Se movió a un componente cliente
// separado para que page.tsx pudiera volver a ser un Server Component y
// exportar generateMetadata (título dinámico con el nombre del producto —
// hallazgo real: TODAS las páginas de la app mostraban el mismo título de
// pestaña "MercadoTech", sin distinguir qué producto/pantalla estás
// viendo; con varias pestañas de productos abiertas era imposible saber
// cuál era cuál). La lógica de acá adentro no cambió ni un carácter.
export function ProductoPageClient() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();
  const { user, profile } = useAuth();

  const { product, images, loading, error, notFound, retry } = useProduct(productId, user?.id);
  // Se llama SIEMPRE (regla de los hooks), con seller_id undefined hasta
  // que product resuelva — useSellerPublicProfile ya maneja ese caso sin
  // disparar ningún fetch.
  const { profile: sellerProfile } = useSellerPublicProfile(product?.seller_id);
  const {
    questions,
    loading: questionsLoading,
    ask,
    answer,
  } = useQuestions(productId);
  const {
    reviews,
    average,
    count,
    canReview,
    loading: reviewsLoading,
    submit: submitReview,
  } = useReviews(productId, user?.id);
  const { isFavorite, toggle: toggleFavorite } = useFavorite(productId, user?.id);
  // useCart() lee el CartProvider montado en (shop)/layout.tsx (Fase 6.5) —
  // sin esto, agregar acá no actualizaba el contador del Navbar (hallazgo
  // real, ver el comentario de cabecera de hooks/useCart.tsx).
  const { add: addToCart } = useCart();

  function requireLogin() {
    router.push(`/login?redirectTo=/producto/${productId}`);
  }

  if (loading) {
    return <LoadingState rows={6} />;
  }

  if (notFound) {
    return (
      <EmptyState
        title="Producto no encontrado"
        description="Este producto no existe o ya no está disponible."
      />
    );
  }

  if (error || !product) {
    return <ErrorState onRetry={retry} />;
  }

  const isOwner = profile?.id === product.seller_id;

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs
        items={[{ label: "Catálogo", href: "/" }, { label: product.title }]}
      />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <ProductGallery images={images} productTitle={product.title} />
        <div className="flex flex-col gap-4">
          <ProductInfo product={product} sellerName={sellerProfile?.display_name} />
          <BuyBox
            product={product}
            hasSession={!!user}
            isOwner={isOwner}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onAddToCart={async (quantity) => {
              try {
                const { added, capped } = await addToCart(product.id, quantity);
                if (added === 0) {
                  toast.info("Ya tienes en el carrito todo el stock disponible de este producto.");
                } else if (capped) {
                  toast.success(
                    `Se agregó${added === 1 ? "" : "n"} ${added}. Llegaste al stock disponible.`,
                  );
                } else {
                  toast.success("Agregado al carrito.");
                }
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            onRequireLogin={requireLogin}
          />
        </div>
      </div>

      <QuestionsSection
        questions={questions}
        hasSession={!!user}
        isOwner={isOwner}
        loading={questionsLoading}
        onAsk={(question) => ask(user!.id, question)}
        onAnswer={answer}
        onRequireLogin={requireLogin}
      />

      <ReviewsSection
        reviews={reviews}
        average={average}
        count={count}
        canReview={canReview.allowed}
        loading={reviewsLoading}
        onSubmit={({ rating, comment }) =>
          submitReview({ buyerId: user!.id, rating, comment })
        }
      />
    </div>
  );
}
