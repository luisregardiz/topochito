import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeDetailScreen } from "./recipe-detail";

export default function RecetaPage({ params }: PageProps<"/recetas/[code]">) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-[1040px] p-5 md:p-8">
          <Skeleton className="aspect-[4/3] w-full max-w-md" />
        </main>
      }
    >
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({
  params,
}: {
  params: PageProps<"/recetas/[code]">["params"];
}) {
  return <RecipeDetailScreen code={(await params).code} />;
}
