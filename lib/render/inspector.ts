import type { SectionType } from "@/lib/schema/page";

/*
 * What the inspector shows for each kind of section.
 *
 * Blueprint section 6.4 is specific: show only the controls relevant to the
 * selection. So this is a description of an editing surface, not a generated
 * form — a schema can say a prop is a string, but only a person can say that
 * `body` wants a textarea, `ctaHref` wants a link picker, and `tone` is four
 * named choices rather than free text.
 *
 * Keeping it beside the registry rather than inside it means the storefront
 * renderer never carries the editor's vocabulary into a customer's bundle.
 */

export type Control =
  | { kind: "text"; prop: string; label: string; placeholder?: string }
  | { kind: "textarea"; prop: string; label: string; rows?: number; hint?: string }
  | { kind: "select"; prop: string; label: string; options: [value: string, label: string][] }
  | { kind: "toggle"; prop: string; label: string; hint?: string }
  | { kind: "number"; prop: string; label: string; min: number; max: number; step?: number }
  | { kind: "link"; prop: string; label: string; hint?: string }
  | { kind: "image"; prop: string; label: string }
  | {
      kind: "items";
      prop: string;
      label: string;
      itemLabel: string;
      max: number;
      fields: { prop: string; label: string; multiline?: boolean }[];
    };

export interface InspectorGroup {
  label: string;
  controls: Control[];
}

const TONE: Control = {
  kind: "select",
  prop: "tone",
  label: "Background",
  options: [
    ["page", "Page"],
    ["surface", "Card"],
    ["raised", "Tinted"],
    ["primary", "Brand colour"],
  ],
};

const ALIGN: Control = {
  kind: "select",
  prop: "align",
  label: "Alignment",
  options: [
    ["left", "Left"],
    ["center", "Centred"],
  ],
};

const COLUMNS = (label = "Columns"): Control => ({
  kind: "select",
  prop: "columns",
  label,
  options: [
    ["2", "Two"],
    ["3", "Three"],
    ["4", "Four"],
  ],
});

export const INSPECTOR: Record<SectionType, InspectorGroup[]> = {
  header: [
    {
      label: "Announcement",
      controls: [
        {
          kind: "text",
          prop: "announcement",
          label: "Bar message",
          placeholder: "Free delivery over ₹1,500",
        },
      ],
    },
    {
      label: "Show",
      controls: [
        { kind: "toggle", prop: "showSearch", label: "Search" },
        { kind: "toggle", prop: "showAccount", label: "Account" },
        { kind: "toggle", prop: "showCart", label: "Cart" },
        {
          kind: "toggle",
          prop: "sticky",
          label: "Stay on screen",
          hint: "Keeps the header visible as people scroll.",
        },
      ],
    },
    { label: "Style", controls: [TONE] },
  ],

  hero: [
    {
      label: "Words",
      controls: [
        { kind: "text", prop: "eyebrow", label: "Small line above", placeholder: "Handmade to order" },
        { kind: "text", prop: "heading", label: "Headline" },
        { kind: "textarea", prop: "body", label: "Supporting text", rows: 3 },
      ],
    },
    {
      label: "Buttons",
      controls: [
        { kind: "text", prop: "ctaLabel", label: "Button text" },
        { kind: "link", prop: "ctaHref", label: "Button goes to" },
        { kind: "text", prop: "secondaryLabel", label: "Second button", placeholder: "Leave blank to hide" },
        { kind: "link", prop: "secondaryHref", label: "Second button goes to" },
      ],
    },
    { label: "Picture", controls: [{ kind: "image", prop: "imageUrl", label: "Image" }] },
    {
      label: "Layout",
      controls: [
        {
          kind: "select",
          prop: "layout",
          label: "Arrangement",
          options: [
            ["split", "Picture beside text"],
            ["stacked", "Text over picture"],
            ["minimal", "Text only"],
          ],
        },
        {
          kind: "select",
          prop: "height",
          label: "Height",
          options: [
            ["compact", "Compact"],
            ["tall", "Tall"],
            ["full", "Full screen"],
          ],
        },
        ALIGN,
        TONE,
      ],
    },
  ],

  productGrid: [
    {
      label: "Words",
      controls: [
        { kind: "text", prop: "heading", label: "Heading" },
        { kind: "textarea", prop: "body", label: "Intro", rows: 2 },
      ],
    },
    {
      label: "Which products",
      controls: [
        {
          kind: "select",
          prop: "source",
          label: "Show",
          options: [
            ["newest", "Newest first"],
            ["featured", "Featured"],
            ["all", "Everything"],
          ],
        },
        { kind: "number", prop: "limit", label: "How many", min: 1, max: 24 },
      ],
    },
    {
      label: "Cards",
      controls: [
        COLUMNS(),
        {
          kind: "select",
          prop: "imageRatio",
          label: "Picture shape",
          options: [
            ["square", "Square"],
            ["portrait", "Tall"],
            ["landscape", "Wide"],
          ],
        },
        {
          kind: "select",
          prop: "cardStyle",
          label: "Card style",
          options: [
            ["plain", "Plain"],
            ["bordered", "Outlined"],
            ["elevated", "Raised"],
          ],
        },
        { kind: "toggle", prop: "showPrice", label: "Show prices" },
        ALIGN,
        TONE,
      ],
    },
  ],

  featureList: [
    { label: "Words", controls: [{ kind: "text", prop: "heading", label: "Heading" }] },
    {
      label: "Points",
      controls: [
        {
          kind: "items",
          prop: "items",
          label: "Points",
          itemLabel: "Point",
          max: 6,
          fields: [
            { prop: "title", label: "Title" },
            { prop: "body", label: "Text", multiline: true },
          ],
        },
      ],
    },
    { label: "Layout", controls: [COLUMNS(), ALIGN, TONE] },
  ],

  richText: [
    {
      label: "Words",
      controls: [
        { kind: "text", prop: "eyebrow", label: "Small line above" },
        { kind: "text", prop: "heading", label: "Heading" },
        {
          kind: "textarea",
          prop: "body",
          label: "Text",
          rows: 8,
          hint: "Leave a blank line between paragraphs.",
        },
      ],
    },
    {
      label: "Layout",
      controls: [
        {
          kind: "select",
          prop: "maxWidth",
          label: "Width",
          options: [
            ["narrow", "Narrow, easier to read"],
            ["wide", "Full width"],
          ],
        },
        ALIGN,
        TONE,
      ],
    },
  ],

  imageBanner: [
    {
      label: "Words",
      controls: [
        { kind: "text", prop: "heading", label: "Heading" },
        { kind: "textarea", prop: "body", label: "Text", rows: 3 },
        { kind: "text", prop: "ctaLabel", label: "Button text" },
        { kind: "link", prop: "ctaHref", label: "Button goes to" },
      ],
    },
    {
      label: "Picture",
      controls: [
        { kind: "image", prop: "imageUrl", label: "Image" },
        {
          kind: "select",
          prop: "imageSide",
          label: "Picture on the",
          options: [
            ["left", "Left"],
            ["right", "Right"],
          ],
        },
      ],
    },
    { label: "Style", controls: [TONE] },
  ],

  gallery: [
    { label: "Words", controls: [{ kind: "text", prop: "heading", label: "Heading" }] },
    { label: "Layout", controls: [COLUMNS("Across"), TONE] },
  ],

  testimonials: [
    { label: "Words", controls: [{ kind: "text", prop: "heading", label: "Heading" }] },
    {
      label: "Quotes",
      controls: [
        {
          kind: "items",
          prop: "items",
          label: "Quotes",
          itemLabel: "Quote",
          max: 9,
          fields: [
            { prop: "quote", label: "What they said", multiline: true },
            { prop: "name", label: "Name" },
            { prop: "detail", label: "Where from" },
          ],
        },
      ],
    },
    {
      label: "Layout",
      controls: [
        {
          kind: "select",
          prop: "layout",
          label: "Arrangement",
          options: [
            ["grid", "Several side by side"],
            ["single", "One, large"],
          ],
        },
        TONE,
      ],
    },
  ],

  faq: [
    { label: "Words", controls: [{ kind: "text", prop: "heading", label: "Heading" }] },
    {
      label: "Questions",
      controls: [
        {
          kind: "items",
          prop: "items",
          label: "Questions",
          itemLabel: "Question",
          max: 20,
          fields: [
            { prop: "question", label: "Question" },
            { prop: "answer", label: "Answer", multiline: true },
          ],
        },
      ],
    },
    { label: "Style", controls: [TONE] },
  ],

  newsletter: [
    {
      label: "Words",
      controls: [
        { kind: "text", prop: "heading", label: "Heading" },
        { kind: "textarea", prop: "body", label: "Text", rows: 2 },
        { kind: "text", prop: "buttonLabel", label: "Button text" },
      ],
    },
    { label: "Layout", controls: [ALIGN, TONE] },
  ],

  contact: [
    {
      label: "Words",
      controls: [
        { kind: "text", prop: "heading", label: "Heading" },
        { kind: "textarea", prop: "body", label: "Text", rows: 2 },
      ],
    },
    {
      label: "Buttons",
      controls: [
        { kind: "toggle", prop: "showWhatsapp", label: "WhatsApp", hint: "Set the number in Store settings." },
        { kind: "toggle", prop: "showInstagram", label: "Instagram" },
        { kind: "toggle", prop: "showEmail", label: "Email" },
      ],
    },
    { label: "Layout", controls: [ALIGN, TONE] },
  ],

  accountLogin: [
    {
      label: "Words",
      controls: [
        { kind: "text", prop: "heading", label: "Heading", placeholder: "Welcome back" },
        {
          kind: "textarea",
          prop: "body",
          label: "Intro",
          rows: 2,
          hint: "Optional. A line above the form.",
        },
        { kind: "text", prop: "buttonLabel", label: "Button", placeholder: "Sign in" },
      ],
    },
    {
      label: "Show",
      controls: [
        {
          kind: "toggle",
          prop: "showSignupLink",
          label: "Link to create an account",
          hint: "Turn this off if you only want people you have already invited.",
        },
        { kind: "text", prop: "signupLabel", label: "Link text" },
      ],
    },
    { label: "Layout", controls: [ALIGN, TONE] },
  ],
  accountSignup: [
    {
      label: "Words",
      controls: [
        { kind: "text", prop: "heading", label: "Heading", placeholder: "Create an account" },
        { kind: "textarea", prop: "body", label: "Intro", rows: 2 },
        { kind: "text", prop: "buttonLabel", label: "Button", placeholder: "Create account" },
      ],
    },
    {
      label: "Ask for",
      controls: [
        {
          kind: "toggle",
          prop: "askName",
          label: "Their name",
          hint: "Whether they sign in by email or mobile is in Store settings.",
        },
        { kind: "toggle", prop: "showSigninLink", label: "Link to sign in" },
      ],
    },
    { label: "Layout", controls: [ALIGN, TONE] },
  ],
  accountArea: [
    {
      label: "Words",
      controls: [{ kind: "text", prop: "heading", label: "Heading", placeholder: "Your account" }],
    },
    {
      label: "Show",
      controls: [
        { kind: "number", prop: "recentOrders", label: "Recent orders", min: 1, max: 10 },
        { kind: "toggle", prop: "showAddresses", label: "Saved addresses" },
        { kind: "toggle", prop: "showWishlist", label: "Saved items" },
      ],
    },
    { label: "Layout", controls: [TONE] },
  ],
  footer: [
    {
      label: "Words",
      controls: [{ kind: "textarea", prop: "blurb", label: "Short description", rows: 3 }],
    },
    {
      label: "Show",
      controls: [{ kind: "toggle", prop: "showSocials", label: "Social links" }],
    },
    { label: "Style", controls: [TONE] },
  ],
};
