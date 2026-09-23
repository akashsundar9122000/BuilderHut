"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button, Card, CardBody, Field, Input, Textarea } from "@/components/ui";
import { ProductImages } from "./ProductImages";
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/app/(dashboard)/app/products/actions";

export interface ProductDraft {
  id: string;
  name: string;
  description: string;
  price: string;
  compareAt: string;
  sku: string;
  status: "draft" | "active" | "archived";
  images: string[];
}

export function ProductForm({
  currencyLabel,
  product,
}: {
  currencyLabel: string;
  /** Absent when creating. Present when editing an existing product. */
  product?: ProductDraft;
}) {
  const [state, submit, pending] = useActionState<ProductFormState, FormData>(
    product ? updateProductAction : createProductAction,
    {},
  );
  const [images, setImages] = useState<string[]>(product?.images ?? []);

  return (
    <form action={submit} className="flex flex-col gap-5">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {/* The whole ordered list, one per line. See readForm in actions.ts. */}
      <input type="hidden" name="images" value={images.join("\n")} />
      <Card>
        <CardBody className="flex flex-col gap-5">
          <Field
            label="Name"
            htmlFor="name"
            error={state.field === "name" ? state.error : undefined}
          >
            <Input
              id="name"
              name="name"
              placeholder="Crochet daisy posy"
              defaultValue={product?.name}
              autoFocus
              required
            />
          </Field>

          <Field label="Description" htmlFor="description" hint="What it is, how big, what it's made of.">
            <Textarea
              id="description"
              name="description"
              rows={4}
              placeholder="A hand-crocheted posy of five daisies on wire stems, about 20cm tall."
              defaultValue={product?.description}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <ProductImages value={images} onChange={setImages} />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field
            label={`Price (${currencyLabel})`}
            htmlFor="price"
            error={state.field === "price" ? state.error : undefined}
            hint="Just the number — 499 or 499.50."
          >
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              placeholder="499"
              defaultValue={product?.price}
              required
            />
          </Field>

          <Field
            label="Compare-at price"
            htmlFor="compareAt"
            error={state.field === "compareAt" ? state.error : undefined}
            hint="Optional. Shows a discount badge."
          >
            <Input
              id="compareAt"
              name="compareAt"
              inputMode="decimal"
              placeholder="699"
              defaultValue={product?.compareAt}
            />
          </Field>

          <Field label="SKU" htmlFor="sku" hint="Optional. Your own reference code.">
            <Input id="sku" name="sku" placeholder="CRO-DAISY-05" defaultValue={product?.sku} />
          </Field>

          <Field label="Status" htmlFor="status" hint="Only live products appear on your storefront.">
            <select
              id="status"
              name="status"
              defaultValue={product?.status ?? "active"}
              className="bg-surface border-border-input text-text h-10 w-full rounded-md border px-3 text-sm coarse:h-11"
            >
              <option value="active">Live</option>
              <option value="draft">Draft</option>
            </select>
          </Field>
        </CardBody>
      </Card>

      {state.error && !state.field ? (
        <p role="alert" className="text-danger bg-danger-soft rounded-md px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      {state.error && state.field === "form" ? (
        <p role="alert" className="text-danger bg-danger-soft rounded-md px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving" : product ? "Save changes" : "Save product"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/app/products">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
