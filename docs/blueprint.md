# E-Commerce Site Builder Platform — Deep Product, UX, Architecture & Implementation Blueprint

> The product specification for BuilderHut, as supplied. Kept verbatim apart from
> stripped citation artefacts from the source document. Where it contradicts
> itself — notably Cloudflare D1 in sections 33/34/61/94/99/102 against Neon
> Postgres in section 35.1 — `docs/plan.md` records which reading won and why.

## Working product concept

A multi-tenant SaaS platform that lets non-technical creators, Instagram sellers, home businesses, artisans, invitation designers, crochet makers, T-shirt sellers, bakers, jewellery makers, small boutiques, digital-product sellers, and similar businesses create and publish a professional e-commerce website without coding.

The platform should feel like a premium combination of:
- Shopify-style commerce management
- Webflow-style visual editing
- Canva-style ease of design
- Framer-style polished interactions
- A marketplace of industry-specific templates
- A centralized platform admin console for the SaaS owner

The product has three major surfaces:
1. Platform website + onboarding
2. Merchant dashboard + visual website builder + storefront
3. Platform owner/admin console

The core principle is: **every important visual element and business setting should be configurable without code, while keeping the default experience extremely polished.**

## 0.1 NON-NEGOTIABLE UI/UX BAR — FLAGSHIP PRODUCT

This is not allowed to look like a generic SaaS dashboard, admin template, Shopify clone, or CRUD application.

The visual quality must match the ambitious standard established by the other products in this product family: highly polished portfolio experiences, premium marketplaces, and modern consumer-style apps with strong animation, visual hierarchy, and personality.

The goal is:

> **A first-time merchant should think "This feels like a premium product" before they even create their store.**

### Overall visual direction

Combine the strongest aspects of:
- Framer-style fluidity
- Webflow-style visual control
- Canva-style simplicity
- Shopify-style commerce clarity
- Linear-style product polish
- Apple-like restraint and hierarchy
- Cinematic portfolio-style storytelling

Do not copy any competitor literally. Build a distinct visual language for this product.

### Landing page experience

The marketing site should feel like a premium product launch rather than a conventional SaaS homepage.

Include:
- cinematic hero section
- animated store previews
- interactive template carousel
- scroll-driven storytelling
- animated typography
- subtle background gradients
- layered cards
- polished hover states
- template previews that feel like real storefronts
- interactive "build a store" demonstration
- before/after customization animation
- customer/store showcase section
- feature storytelling rather than giant walls of text
- pricing interaction
- FAQ accordion with smooth motion
- polished footer

The first viewport should immediately demonstrate what the builder can create.

### Visual language

Use a strong design system with:
- premium typography pairing
- deliberate whitespace
- large editorial headlines
- restrained gradients
- subtle glass/surface treatment where appropriate
- soft depth and layered surfaces
- carefully chosen corner radii
- high-quality iconography
- visually rich charts
- strong empty states
- tasteful grain/noise where appropriate
- responsive layouts that still feel designed on mobile

Avoid:
- generic purple SaaS gradients everywhere
- excessive glassmorphism
- giant shadows
- excessive rounded cards
- every section being a card inside another card
- dashboard visual clutter
- unnecessary badges
- cheap-looking icon sets
- animation for animation's sake

### Motion system

Motion is a product feature, not decoration.

Use:
- page transitions
- staggered entrance animations
- shared-layout transitions where useful
- smooth sidebar transitions
- magnetic/interactive primary actions where appropriate
- spring-based dropdowns and drawers
- drag previews
- contextual inspector transitions
- animated chart rendering
- hover transformations
- button press feedback
- publish success choreography
- template switching transitions
- skeleton-to-content transitions
- subtle scroll-linked animation

Every animation must have a reason: orientation, feedback, hierarchy, continuity, or delight.

Target a premium feel at 60fps on ordinary modern laptops and phones. Respect `prefers-reduced-motion`.

### Builder UX must feel magical

The visual builder is the hero product. It should feel closer to a professional design tool than an admin page.

The canvas should dominate the screen.

Use:
- floating contextual controls
- elegant selection outlines
- intelligent snapping
- alignment guides
- drag insertion indicators
- breadcrumb-like element hierarchy
- quick duplicate/delete controls
- keyboard shortcuts
- command palette
- multi-select
- copy/paste styles
- responsive breakpoint controls
- live preview
- device preview
- undo/redo history
- autosave indicator
- version history
- draft/published state
- one-click preview

When selecting an element, show only the controls relevant to that element. Avoid overwhelming users with every setting at once.

### Merchant dashboard must feel like a command center

The dashboard should not be a static collection of cards.

It should communicate:
- what is happening
- what needs attention
- what changed
- what is performing well
- what the merchant can do next

Use visual storytelling in analytics, meaningful comparison periods, activity timelines, health indicators, quick actions, and contextual recommendations.

### Platform admin console must feel premium and powerful

This is an internal operations product, so it can be denser than the merchant dashboard, but it must remain elegant.

The admin console should include:
- command-center overview
- merchant growth
- active stores
- traffic
- GMV
- platform revenue
- conversion funnel
- template popularity
- infrastructure health
- domain health
- payment activity
- failed jobs
- incidents
- audit events

Use dense data tables only where they actually help. Pair tables with visual summaries and contextual actions.

### Storefronts must NOT all look alike

The published websites should reflect the merchant's industry.

A crochet store, invitation designer, fashion seller, bakery, jewellery brand, digital-product creator, and local boutique should feel like completely different brands even though they use the same platform.

Templates must have their own composition, typography personality, spacing, interaction patterns, product presentation, and storytelling.

### Responsive excellence

Do not treat mobile as "desktop but narrower."

Design mobile layouts intentionally:
- mobile-first navigation behavior
- bottom sheets where appropriate
- mobile builder controls
- touch-friendly drag handles
- adaptive data visualization
- sticky mobile checkout actions
- bottom navigation where useful
- correct typography scaling
- optimized storefront hero sections

### Micro-interactions

Specify polished states for every interactive component:
- default
- hover
- focus
- active
- pressed
- loading
- success
- warning
- error
- disabled

Nothing should feel unfinished.

### Performance guardrail

Premium animation must not become a performance problem. Prefer transform/opacity animation, avoid unnecessary layout thrashing, lazy-load heavy visual assets, optimize images, virtualize long lists where needed, and keep the builder responsive during drag operations.

---

# 1. PRODUCT GOAL

A merchant should be able to go from zero to a live store in roughly this flow:

Sign up → verify email → choose business type → answer a few setup questions → choose a template → customize website → configure products → configure shipping/tax/payment settings → choose free platform subdomain or custom domain → preview → publish.

Example:

> An Instagram seller who makes handmade crochet flowers should be able to say "I sell handmade crochet flowers and gift products", choose a handmade/craft template, upload 10 product photos, enter prices, customize colors/fonts, create product categories, configure delivery/pickup, and publish a professional website without writing code.

---

# 2. CORE USER TYPES

## 2.1 Visitor

A person who visits a merchant's storefront.

Capabilities:
- Browse products
- Search
- Filter
- View product details
- Add to cart
- Update cart
- Checkout
- Make dummy payment
- Create customer account
- Login
- View order history
- Wishlist
- Contact merchant
- Share products
- Subscribe to newsletter

## 2.2 Merchant / Store Owner

The person creating and operating a site.

Capabilities:
- Create one or more websites/stores depending on plan
- Visual website editing
- Manage products
- Manage categories
- Manage orders
- Manage customers
- Manage discounts
- Manage inventory
- Manage shipping
- Manage taxes
- Manage content/pages
- Manage navigation
- Manage store theme
- Manage domains
- View analytics
- Manage staff later
- Manage notifications
- View revenue
- Configure checkout

## 2.3 Merchant Staff

Optional later role.

Roles:
- Owner
- Admin
- Manager
- Product Manager
- Order Manager
- Content Editor
- Analyst

Use RBAC from day one even if only Owner is exposed initially.

## 2.4 Platform Administrator

The owner/operator of this SaaS platform.

Can view:
- All registered users
- All stores
- All websites
- Store status
- Template usage
- Traffic
- Clicks
- Orders
- GMV/revenue generated by merchant stores
- Platform revenue
- Platform fees
- Domains
- Hosting usage
- Product/catalog statistics
- Customer activity
- Support issues
- Audit logs
- Security alerts
- System health
- Errors
- Abuse reports
- Suspended stores

---

# 3. MULTI-TENANT MODEL

Everything must be tenant-aware.

Hierarchy:

Platform
└── User
    └── Store / Tenant
        ├── Website
        ├── Domain(s)
        ├── Theme
        ├── Pages
        ├── Products
        ├── Categories
        ├── Orders
        ├── Customers
        ├── Discounts
        ├── Inventory
        ├── Shipping rules
        ├── Tax rules
        ├── Analytics
        └── Media/assets

Do not mix merchant data across tenants.

Every business data record should include `tenantId` or a relation that guarantees tenant ownership.

Recommended logical identifiers:
- platformUserId
- tenantId
- websiteId
- pageId
- productId
- orderId
- customerId
- domainId
- templateId

Never trust a client-supplied tenantId for authorization. Derive tenant identity from authenticated session/context and validate every resource access server-side.

---

# 4. ONBOARDING EXPERIENCE

## 4.1 Landing page

The platform's marketing website should explain:
- Build your store in minutes
- Professional templates
- No coding
- Sell products online
- Custom domain support
- Mobile-first stores
- Analytics
- Easy product management

Primary CTA:
`Create my store`

Secondary CTA:
`Explore templates`

Show polished template previews and example industries.

## 4.2 Sign up

Fields:
- Full name
- Email
- Password
- Confirm password
- Optional phone
- Terms acceptance

Social login architecture should be prepared for:
- Google
- GitHub

Do not make social login mandatory.

## 4.3 Email verification

Before activating the account:
1. Create a temporary pending registration
2. Generate a short verification code
3. Email code
4. User enters code
5. Verify code + expiry + attempt limit
6. Only then activate account

Security:
- Hash verification codes if persisted
- Short expiration
- Attempt limit
- Resend cooldown
- Rate limiting
- Audit log

Example screen:

`Check your email`
`We sent a 6-digit code to a***@gmail.com`

Actions:
- Verify
- Resend code
- Change email

## 4.4 Business setup wizard

Step 1 — What do you sell?

Cards:
- Handmade & Crafts
- Crochet
- Invitation & Printing
- Clothing / T-Shirts
- Jewellery
- Beauty
- Food & Bakery
- Home Decor
- Art & Paintings
- Digital Products
- Gifts
- Electronics
- Other

Step 2 — Business name

Step 3 — Main sales channel
- Instagram
- WhatsApp
- Offline store
- Existing website
- New business
- Other

Step 4 — What do you want?
- Product catalog
- Online checkout
- Bookings/services
- Portfolio + enquiry
- Full e-commerce

Step 5 — Currency / region
Default intelligently, but allow modification.

Step 6 — Brand basics
- Logo
- Brand name
- Primary color
- Accent color
- Font style

Step 7 — Template recommendations
Show 6–12 personalized templates based on industry.

## 4.5 Initial admin account creation

During setup, explicitly create the store owner/admin account.

Flow:
`Admin email` → `Send code` → `Verify code` → `Set password` → `Create store`.

The merchant dashboard should make it obvious that this is the store owner account.

---

# 5. TEMPLATE SYSTEM

Templates are not static screenshots. They are structured design systems that can be edited through the builder.

Each template should define:
- Theme tokens
- Global colors
- Typography
- Page definitions
- Component tree
- Section layouts
- Navigation
- Footer
- Product card style
- Product detail style
- Cart style
- Checkout style
- Responsive behavior
- Animation presets
- SEO defaults

Template examples:

### Handmade / Crochet
- Warm neutral background
- Large product imagery
- Storytelling sections
- Handmade process section
- Testimonials
- Instagram gallery

### Invitation Studio
- Elegant typography
- Event categories
- Portfolio gallery
- Custom-order CTA
- Pricing/enquiry sections
- WhatsApp/contact CTA

### T-shirt / Streetwear
- Editorial hero
- Product grid
- Collection banners
- Size guide
- Lookbook
- Limited drop countdown

### Jewellery
- Premium light/dark presentation
- Editorial product imagery
- Collection navigation
- Product zoom
- Material details

### Bakery
- Product categories
- Bestseller section
- Delivery area
- Pre-order date selector
- Custom cake enquiry

### Digital products
- Instant purchase messaging
- File/product preview
- FAQ
- Trust badges

Need at least 20–30 polished templates in the first meaningful release, with 5+ variants for the most important industries.

---

# 6. VISUAL WEBSITE BUILDER

This is the most important part of the product.

## 6.1 Builder layout

Three-column desktop layout:

LEFT — Component/section library
CENTER — Live canvas
RIGHT — Contextual properties inspector

Top bar:
- Back to dashboard
- Store name
- Save state
- Undo
- Redo
- Device preview
- Preview
- Publish
- More

## 6.2 Left sidebar

Tabs:
- Add
- Layers
- Pages
- Assets

Add panel categories:
- Sections
- Layouts
- Text
- Images
- Video
- Buttons
- Product blocks
- Product grids
- Collections
- Testimonials
- FAQ
- Countdown
- Announcement
- Newsletter
- Forms
- Social
- Maps
- Reviews
- Custom HTML (advanced plan later)

## 6.3 Canvas

Requirements:
- Drag-and-drop
- Reorder sections
- Reorder components within sections
- Duplicate
- Delete
- Hide
- Lock
- Multi-select where practical
- Snap guides
- Responsive preview
- Scroll preview
- Hover states
- Selected-component outline
- Breadcrumb path to selected component

Do not make the first version completely freeform like Photoshop. Use a responsive section/grid model so generated sites remain stable.

Later add an optional advanced freeform mode.

## 6.4 Right inspector

Every selected component should have context-sensitive controls.

Common:
- Visibility
- Width
- Max width
- Height/min-height
- Padding
- Margin
- Gap
- Alignment
- Background
- Border
- Radius
- Shadow
- Opacity
- Animation
- Responsive overrides

Typography:
- Font family
- Size
- Weight
- Line height
- Letter spacing
- Alignment
- Transform

Button:
- Text
- Link
- Style
- Size
- Icon
- Icon position
- Hover behavior
- Disabled state

Image:
- Asset
- Crop
- Fit
- Position
- Border radius
- Overlay
- Alt text
- Link

Product component:
- Product source
- Category
- Sort
- Number of items
- Grid columns
- Card style
- Price visibility
- Rating visibility
- Quick add

## 6.5 Global theme editor

Provide one central theme panel:

Brand:
- Primary
- Secondary
- Accent
- Background
- Surface
- Text
- Muted
- Border
- Success
- Warning
- Error

Typography:
- Heading font
- Body font
- Button font
- H1–H6 presets

Shape:
- Corner radius scale
- Button shape
- Card shape

Spacing:
- 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 system

Effects:
- Shadow presets
- Glass effect
- Blur
- Motion style

## 6.6 Responsive editor

Devices:
- Desktop
- Tablet
- Mobile

Support responsive overrides without duplicating entire pages.

Common responsive settings:
- Stack columns
- Hide element
- Font scaling
- Padding
- Image crop
- Grid columns
- Alignment

## 6.7 Undo / redo

Use command/history architecture rather than blindly saving snapshots.

Support:
- Undo
- Redo
- Named page history later

## 6.8 Autosave

Save drafts automatically.

Show:
`Saved just now`

If save fails:
`Offline changes saved locally — retrying`

Never silently lose changes.

## 6.9 Versioning

Merchant should be able to:
- Save draft
- Publish version
- See publication history
- Restore previous published version

Store immutable published revisions.

---

# 7. PAGE BUILDER

Default pages:
- Home
- Shop
- Product Details
- Categories / Collections
- Cart
- Checkout
- Order Success
- Login
- Signup
- Customer Account
- Order History
- About
- Contact
- FAQ
- Privacy Policy
- Terms
- Shipping Policy
- Refund Policy

Merchant can:
- Create page
- Duplicate page
- Rename page
- Set slug
- Change SEO metadata
- Hide page from navigation
- Delete page
- Set homepage

Support dynamic/system pages which cannot be deleted.

---

# 8. STORE FRONTEND

## Header

Configurable:
- Logo
- Navigation
- Search
- Account
- Cart
- Wishlist
- Announcement bar
- Mobile menu

## Homepage

Possible sections:
- Hero
- Featured products
- Categories
- Best sellers
- New arrivals
- Brand story
- Promotional banner
- Testimonials
- Reviews
- FAQ
- Instagram/social section
- Newsletter
- CTA

## Shop

Features:
- Search
- Filters
- Sort
- Pagination or infinite scroll
- Category filter
- Price filter
- Availability
- Tags
- Rating

## Product page

Features:
- Image gallery
- Zoom
- Product name
- Price
- Compare-at price
- Discount badge
- Variants
- Quantity
- Add to cart
- Buy now
- Wishlist
- Delivery estimate
- Shipping message
- Description
- Specifications
- Reviews
- Related products
- Recently viewed

---

# 9. MERCHANT ADMIN CONSOLE

The merchant console should feel like a premium SaaS control panel.

Sidebar:

Dashboard
Store Builder
Products
Collections
Orders
Customers
Inventory
Discounts
Content
Analytics
Marketing
Store Settings
Payments
Shipping
Taxes
Domains
Team
Notifications
Help

## Dashboard

Top KPI cards:
- Revenue
- Orders
- Visitors
- Conversion rate
- Average order value
- Products sold

Charts:
- Revenue trend
- Orders trend
- Visitors trend
- Conversion funnel

Panels:
- Recent orders
- Top products
- Low stock
- Best traffic sources
- Pending actions
- Store health

Quick actions:
- Add product
- Edit storefront
- View orders
- Add discount
- Publish changes

## Product management

Fields:
- Product name
- Slug
- Description
- Images
- Videos
- Price
- Compare-at price
- Cost price
- SKU
- Barcode
- Inventory
- Variants
- Weight
- Dimensions
- Category
- Tags
- SEO title
- SEO description
- Product status

Statuses:
- Draft
- Active
- Archived

Bulk operations:
- Delete
- Archive
- Update price
- Update inventory
- Assign category
- Add tag

CSV import/export should be designed into the data model.

## Orders

Order statuses:
- Pending payment
- Paid
- Processing
- Packed
- Shipped
- Delivered
- Cancelled
- Refunded
- Partially refunded

Order screen:
- Customer info
- Products
- Quantity
- Price
- Discounts
- Shipping
- Taxes
- Payment status
- Transaction reference
- Fulfillment timeline
- Internal notes
- Customer notes

## Customers

Show:
- Name
- Email
- Phone
- Number of orders
- Total spend
- Last order
- Tags
- Notes

Customer timeline:
- Account created
- Product viewed
- Cart created
- Purchase
- Refund
- Coupon use

## Inventory

Features:
- Stock level
- Low-stock threshold
- Out-of-stock status
- Inventory adjustment history
- Variant inventory

## Discounts

Types:
- Percentage
- Fixed amount
- Free shipping
- Product-specific
- Collection-specific
- First-order
- Minimum cart value
- Limited-use
- Expiry date

## Content manager

- Pages
- Blog/posts later
- Banners
- FAQs
- Testimonials
- Media

---

# 10. CHECKOUT

Checkout must be a configurable merchant setting.

Possible checkout modes:
- Guest checkout
- Account required
- Optional account creation

Fields:
- Name
- Email
- Phone
- Address
- City
- State/region
- Postal code
- Country
- Delivery notes

Merchant settings:
- Required/optional fields
- Order notes
- Marketing consent
- Terms checkbox

---

# 11. DUMMY PAYMENT GATEWAY

For this version do not integrate real money movement.

Build a realistic internal payment abstraction.

Payment interface:

`PaymentProvider`
- createPaymentIntent()
- getPaymentStatus()
- capturePayment()
- refundPayment()
- cancelPayment()
- verifyWebhook()

Implement:
`DummyPaymentProvider`

Dummy payment UI should look like a real checkout but clearly be simulated in the platform development environment.

Simulated outcomes:
- Success
- Failed
- Cancelled
- Pending
- Timeout
- Refund
- Partial refund

Generate transaction IDs.

Merchant test mode:
- Test card: success
- Test card: failure
- Test card: pending

Do not use real card data.

Design the system so later integrations can include:
- Razorpay
- Stripe
- PayPal
- Other regional gateways

Do not hard-code payment logic into order logic. Use a provider abstraction.

---

# 12. SHIPPING

Merchant settings:
- Local delivery
- Store pickup
- Standard shipping
- Express shipping
- Free shipping threshold
- Flat-rate shipping
- Weight-based shipping later
- Region-based shipping

Shipping zones:
- Local
- State/region
- Country
- International

Later:
- Carrier integrations
- Tracking number
- Shipping labels

---

# 13. TAXES

Create generic configurable tax rules.

Do not hard-code a jurisdiction-specific tax percentage as universal truth.

Merchant can configure:
- Tax name
- Rate
- Inclusive/exclusive
- Product/category applicability
- Region applicability

For India-oriented merchants, leave room for GST-related fields such as GSTIN, HSN/SAC, but make jurisdiction-specific rules configurable and independently validated before using them in production.

---

# 14. DOMAIN & HOSTING EXPERIENCE

## Free store hosting

Give each published store a platform URL such as:

`store-slug.platform-domain.example`

The merchant can change the slug if available.

Important architecture:
- Cloudflare Workers serve the storefront
- D1 stores structured application/store data
- R2 stores images and other large assets
- KV can hold cached/published configuration and other high-read key/value data
- Analytics Engine can record high-cardinality usage events
- Queues can process non-blocking jobs such as emails, analytics aggregation, image processing, or webhooks

## Bring Your Own Domain

Merchant enters:
`www.mystore.com`

Show:
1. Domain added
2. DNS verification
3. SSL certificate status
4. Routing status
5. Live test

Support:
- root domain
- www subdomain
- custom subdomain

## Buy a new domain

Design the product now, integrate registrar APIs later.

UI:
- Search domain
- Suggested names
- TLD filters
- Availability
- Price
- Cart
- Checkout
- Auto-connect after purchase

Create a domain-provider abstraction so the UI is not coupled to a registrar.

---

# 15. PLATFORM-LEVEL ADMIN CONSOLE

This dashboard is for the owner/operator of this website-builder SaaS.

It should feel substantially more powerful than the merchant dashboard.

Sidebar:

Overview
Users
Stores
Websites
Templates
Domains
Orders
Revenue
Analytics
Infrastructure
Usage
Support
Reports
Security
Audit Logs
Settings

## Platform overview

Hero KPIs:
- Total users
- Active merchants
- Active stores
- Published stores
- Total visitors
- Total page views
- Total clicks
- Total orders
- GMV
- Platform revenue
- Monthly recurring revenue, when subscriptions are implemented

Trend widgets:
- New merchants
- New stores
- Published stores
- Orders
- GMV
- Platform revenue

## Store explorer

Table columns:
- Store
- Owner
- Industry
- Template
- Status
- Domain
- Visits
- Orders
- GMV
- Platform fees
- Created date
- Last active

Actions:
- View
- Open storefront
- View analytics
- Suspend
- Restore
- Contact owner
- View audit log

## User explorer

Filters:
- New users
- Active
- Suspended
- Free
- Paid
- Industry
- Date range

## Website monitoring

Show each website's:
- Availability
- Response time
- Traffic
- Errors
- Last publish
- Domain status
- SSL status

## Template analytics

Measure:
- Template installs
- Template activation rate
- Template publish rate
- Template conversion rate
- Industry distribution

## Revenue console

Track separately:
- Merchant GMV
- Refunds
- Net merchant sales
- Platform fees
- Subscription revenue
- Domain revenue
- Add-on revenue

Never label merchant sales as the platform's own revenue.

---

# 16. ANALYTICS SYSTEM

Track event-level data.

Event examples:
- page_view
- session_start
- product_view
- search
- category_view
- add_to_cart
- remove_from_cart
- checkout_start
- payment_attempt
- payment_success
- payment_failure
- order_created
- order_paid
- refund_created
- wishlist_add
- signup
- login
- newsletter_subscribe
- contact_click
- whatsapp_click
- instagram_click
- phone_click
- external_link_click
- template_selected
- store_published

Each event should include, when appropriate:
- tenantId
- websiteId
- eventName
- timestamp
- sessionId
- anonymousVisitorId
- pageId
- productId
- referrer
- UTM source/medium/campaign
- country/region at coarse level where legally and technically appropriate
- device class
- browser family

## Merchant analytics dashboard

Date range:
- Today
- 7 days
- 30 days
- 90 days
- Custom

Cards:
- Visitors
- Sessions
- Page views
- Product views
- Add-to-cart rate
- Checkout rate
- Conversion rate
- Orders
- Revenue

Charts:
- Visitors over time
- Revenue over time
- Orders over time
- Conversion funnel
- Traffic sources
- Top pages
- Top products
- Device breakdown

## Platform analytics

Additional dimensions:
- tenant
- template
- industry
- plan
- domain type
- hosting type
- traffic band

---

# 17. MERCHANT REVENUE VS PLATFORM REVENUE

These must be two different concepts.

Example:

Merchant GMV = ₹100,000
Refunds = ₹5,000
Net merchant sales = ₹95,000
Platform fee = ₹2,000
Platform subscription revenue = ₹499

Platform revenue = ₹2,499

This separation will make later billing/accounting integrations possible.

---

# 18. ADMIN DASHBOARD VISUAL DESIGN

The platform must not look like a generic bootstrap admin panel.

Visual direction:
- Dark/Light mode
- High-quality cards
- Large, readable numbers
- Subtle gradients
- Fine borders
- Soft shadows
- Strong hierarchy
- Responsive tables
- Animated chart transitions
- Skeleton loading
- Empty states
- Command palette
- Keyboard shortcuts
- Toast notifications
- Contextual drawers instead of too many modal dialogs

Navigation should support collapsing the sidebar.

Use consistent spacing and typography tokens.

Create a reusable dashboard component library:
- KPI card
- Trend card
- Chart card
- Data table
- Filter bar
- Date range picker
- Search input
- Status badge
- Activity timeline
- Side drawer
- Confirmation dialog
- Empty state
- Error state
- Skeleton
- Command menu

---

# 19. STORE BUILDER UX DETAILS

Every interaction should have feedback.

Examples:

Drag component:
- show insertion line

Save:
- show saving state
- show saved time

Publish:
- show pre-publish checklist

Deleting:
- reversible toast where practical

Unsaved changes:
- warn before leaving

Publish checklist:
- Store name configured
- At least one active product
- Currency set
- Payment mode configured
- Shipping configured or pickup enabled
- Required legal pages configured
- Homepage published
- Domain available or platform subdomain selected

Then:
`Publish store`

---

# 20. STORE HEALTH

Merchant dashboard should show a store-health score as a checklist, not a vague grade.

Examples:
- Add logo
- Add 5 products
- Complete shipping settings
- Add store policies
- Connect domain
- Configure checkout
- Test an order
- Add SEO metadata
- Add social links

Each item has:
`Fix now` action.

---

# 21. SEO

Per store:
- Site title
- Meta description
- Open Graph image
- Favicon
- Canonical URL
- Robots setting

Per page:
- SEO title
- Meta description
- Slug
- Social image

Per product:
- SEO title
- Description
- Canonical URL

Automatically generate where missing, but allow override.

Generate structured data where applicable:
- Organization
- Product
- Breadcrumb
- Article later

Generate sitemap and robots configuration.

---

# 22. MEDIA LIBRARY

Central media library:
- Images
- Videos
- Documents

Features:
- Upload
- Drag-and-drop
- Folder/tag organization
- Search
- Preview
- Copy URL
- Delete
- Replace asset
- Alt text
- Dimensions
- File size

R2 is the intended object-storage layer for this design.

Add image optimization later:
- resize
- WebP/AVIF variants
- responsive sizes
- lazy loading

---

# 23. CUSTOMER ACCOUNT EXPERIENCE

Storefront customer area:
- Profile
- Addresses
- Orders
- Order details
- Wishlist
- Saved items
- Logout

Order detail timeline:
- Order placed
- Payment confirmed
- Processing
- Shipped
- Delivered

---

# 24. NOTIFICATION SYSTEM

Merchant notifications:
- New order
- Payment received
- Payment failed
- Low stock
- Refund
- Domain connected
- Store published

Channels architecture:
- In-app
- Email
- WhatsApp/SMS later

Use event-driven notification handlers.

---

# 25. SEARCH

Merchant search:
- Products
- Orders
- Customers

Storefront search:
- Product names
- Descriptions
- Tags
- Categories

Platform search:
- Users
- Stores
- Domains
- Orders

Use an abstraction so a dedicated search engine can be added later.

---

# 26. AI FEATURES — STRONGLY RECOMMENDED

Add an optional AI assistant inside the builder.

Prompt examples:
- "Make my homepage look more premium."
- "Create a festive Diwali banner."
- "Rewrite this product description."
- "Suggest a better hero section."
- "Create SEO title and description."
- "Generate a FAQ from my products."
- "Suggest five product categories."

AI should return structured changes rather than arbitrary frontend source code whenever possible.

Example:
`changeTheme({ primaryColor, radius, fontPair })`

`addSection({ type: "testimonials", position: 5 })`

This keeps the visual editor authoritative.

AI image generation can later be used for:
- hero banners
- background textures
- campaign images
- product scene generation

---

# 27. MARKETING FEATURES

Merchant can create:
- Discount codes
- Coupon campaigns
- Campaign banners
- Flash sale timers
- Newsletter signup
- Abandoned cart event tracking
- Basic campaign analytics

Later:
- Email marketing
- Meta/Google ad integrations
- Pixel integrations
- Affiliate/referral system

---

# 28. SOCIAL-FIRST FEATURES

Because the target audience may originate from Instagram, build these intentionally.

One-click actions:
- Copy store link
- Share product
- Share catalog
- Instagram profile button
- WhatsApp button
- Copy product caption

Later:
- Instagram feed integration
- WhatsApp order flow
- social campaign attribution

Track click events separately.

---

# 29. DOMAIN MANAGEMENT

Domain page should show a visual status timeline.

Example:

[✓] Domain added
[✓] DNS detected
[✓] Ownership verified
[✓] SSL active
[✓] Store connected

Warnings:
- DNS missing
- Wrong record
- Certificate pending
- Domain already assigned

Allow multiple domains but designate one primary domain.

Redirect alternate domains to primary domain.

---

# 30. SECURITY ARCHITECTURE

Required:
- Secure password hashing
- Email verification
- Session rotation
- CSRF protections where applicable
- Rate limiting
- Input validation
- Output encoding
- Server-side authorization
- Tenant isolation
- Audit logs
- Secure HTTP headers
- Content Security Policy strategy
- Secure cookie settings
- Secret storage
- Signed webhooks
- Idempotent payment/order handlers

Merchant data must not be queryable by another merchant by changing an ID in the browser.

Add security tests specifically for horizontal privilege escalation.

---

# 31. AUDIT LOGS

Platform and merchant critical actions:
- Login
- Logout
- Password change
- Store created
- User invited
- Product created
- Product edited
- Product deleted
- Order status changed
- Refund created
- Payment config changed
- Domain changed
- Store published
- Store reverted
- User role changed
- Store suspended

Audit log fields:
- actorId
- actorRole
- tenantId
- action
- entityType
- entityId
- metadata
- timestamp
- request context

---

# 32. BACKUP / RECOVERY

Design explicit backup/version strategy.

Important recoverable entities:
- Theme
- Pages
- Products
- Store config
- Navigation
- Domain config
- Orders

Published website versions should be immutable so rollback is safe.

---

# 33. STORE PUBLISH ARCHITECTURE

Recommended approach:

1. Builder edits draft JSON/config
2. Draft saved in application database
3. Publish validates data
4. Create a versioned published snapshot
5. Cache publish snapshot for fast storefront reads
6. Storefront Worker resolves hostname → websiteId/tenantId
7. Load published configuration
8. Render storefront
9. Track analytics asynchronously

Do not make the live storefront depend on the unfinished draft.

Suggested key resolution:

`hostname → domain mapping → websiteId → publishedVersionId → published site data`

Use cache/KV for hot lookup paths where appropriate.

---

# 34. STOREFRONT RENDERING MODEL

Recommended data representation:

```json
{
  "pageId": "home",
  "version": 3,
  "theme": {
    "colors": {},
    "typography": {},
    "spacing": {}
  },
  "sections": [
    {
      "id": "hero-1",
      "type": "hero",
      "props": {},
      "children": []
    }
  ]
}
```

Create a controlled component registry:

`hero`, `navbar`, `productGrid`, `banner`, `richText`, `image`, `video`, `testimonial`, `faq`, `newsletter`, etc.

Never allow arbitrary unvalidated component type names from the browser.

---

# 35. DATABASE MODEL — CORE TABLES

Suggested entities:

Identity:
- users
- user_sessions
- email_verifications
- oauth_accounts

Tenancy:
- tenants
- tenant_members
- tenant_settings

Website:
- websites
- domains
- domain_verifications
- site_versions
- pages
- page_versions
- navigation_items
- themes
- theme_versions

Catalog:
- products
- product_variants
- product_images
- categories
- product_categories
- tags
- product_tags
- inventory

Commerce:
- carts
- cart_items
- orders
- order_items
- order_addresses
- payments
- refunds
- discounts
- discount_redemptions

Customers:
- customers
- customer_addresses
- wishlists
- wishlist_items

Operations:
- shipping_zones
- shipping_methods
- tax_rules
- notifications
- audit_logs

Analytics:
- analytics_daily_rollups
- optionally raw events externally/analytics engine

Platform:
- templates
- template_versions
- plans
- subscriptions
- platform_settings
- abuse_reports

Media:
- media_assets

## 35.1 DATABASE HANDLING — PRODUCTION-GRADE MULTI-TENANT NEON ARCHITECTURE

The database is a core BuilderHut subsystem, not an implementation detail. BuilderHut owns and operates the data layer for every merchant-created store. Design it so the platform can start with a few stores and grow to thousands or more without changing the fundamental tenancy model.

### Database provider decision

Use **one dedicated Neon PostgreSQL project for BuilderHut** under the existing Neon account/organization. Do not create a separate Neon account just for BuilderHut, and do not create a separate Neon project/database for every merchant in the initial architecture.

Neon supports branching workflows for isolated development/staging environments.

### Cloudflare-to-Neon connection

Because BuilderHut's application and storefront runtime are planned for Cloudflare Workers, use a serverless-compatible database connection strategy. Cloudflare currently documents **Hyperdrive as the recommended path for connecting Workers to Neon/Postgres**, with the Neon serverless driver also supported.

The browser must never receive the Neon connection string. Store credentials as Worker secrets and keep them out of source control.

### Multi-tenant strategy — CRITICAL

Use a **shared multi-tenant PostgreSQL architecture** initially.

Do not build a separate Neon project per merchant. Instead, every merchant-owned record must be associated with a tenant/store identifier. The backend derives the tenant from the authenticated session and authorization context; never trust a tenant ID supplied by the browser.

A future enterprise tier may move exceptional tenants to isolated databases/projects, but that is a later scaling option, not the MVP architecture.

### Tenant hierarchy

```text
User
 └── Tenant / Business
      ├── Members
      ├── Website / Store
      │    ├── Pages
      │    ├── Themes
      │    ├── Products
      │    ├── Orders
      │    ├── Customers
      │    ├── Domains
      │    └── Analytics references
      ├── Settings
      └── Subscription / Entitlements
```

Do not assume one user equals one business forever. Model users, tenants, memberships, roles and permissions separately.

### Tenant identifiers and common fields

Use UUID/ULID-style identifiers for externally exposed resources where practical. Avoid sequential IDs in public URLs where enumeration would be undesirable.

Tenant-owned entities should commonly contain: `id`, `tenant_id`, `created_at`, `updated_at`, `created_by`, `updated_by`.

Use `deleted_at` only for entities where recovery/history is useful.

### Logical database domains

Organize the schema conceptually as: identity, tenancy, storefront, catalog, commerce, customers, operations, platform, media.

### Builder data model

The visual editor must use a **versioned structured document model**, not arbitrary HTML as the source of truth.

Use JSON/JSONB for page/component/theme documents and normal relational columns for business-critical entities such as products, orders, payments, inventory, customers and domains.

### Tenant-scoped uniqueness

Most merchant identifiers should be unique within a tenant rather than globally:

```text
UNIQUE (tenant_id, slug)
UNIQUE (tenant_id, sku)
UNIQUE (tenant_id, product_handle)
UNIQUE (tenant_id, coupon_code)
```

For domains, `normalized_hostname` should be globally unique because one hostname cannot belong to two stores at the same time.

### Constraints and referential integrity

Use PostgreSQL constraints aggressively: `NOT NULL` for required data, foreign keys for relationships, unique constraints for tenant-scoped identities, check constraints for valid states and non-negative quantities, explicit currency codes on money-bearing records.

Do not rely only on frontend validation.

### Indexing strategy

Index for real query paths rather than every column. At minimum evaluate foreign keys used in joins, `(tenant_id, created_at DESC)`, `(tenant_id, status, created_at DESC)`, `(tenant_id, slug)`, `(tenant_id, email)`, `(website_id, status)`, `(normalized_hostname)`, audit logs by tenant/date, notifications by tenant/unread state.

### Draft and autosave handling

Do not write a brand-new immutable version on every keystroke.

```text
Canvas edit → local editor state → debounced autosave → draft persistence
            → periodic version snapshot → publish creates immutable version
```

Use optimistic UI, but keep a server-side revision/version number so stale writes cannot silently overwrite newer changes.

### Optimistic concurrency

The client sends `expected_revision`. The server accepts only when that revision is still current and then increments it. Otherwise return a conflict that the editor can resolve. This becomes essential when multiple merchant staff members can edit a store.

### Transactions

Use PostgreSQL transactions whenever multiple records must change atomically: order + order items + payment record; stock change + inventory movement; refund + payment status; publish version + website published pointer; membership acceptance + role assignment; discount redemption counter.

Do not assume sequential API queries are atomic.

### Idempotency

Critical mutation endpoints must support idempotency keys where duplicate requests are possible: checkout, order creation, payment creation, refunds, publish, domain connection, invitation acceptance.

A browser double-click or a queue/network retry must not create duplicate orders or payments.

### Inventory consistency

Inventory must be modified server-side inside transactional logic. Consider both an `inventory` balance and `inventory_movements` history. Movement reasons: sale, cancellation, refund, restock, manual adjustment, import.

### Money handling

Never store prices as floating-point numbers. Prefer integer minor units or PostgreSQL numeric/decimal values with explicit currency.

Store currency with every monetary record that needs to remain historically accurate.

### Historical order integrity

Orders must preserve historical values even after products change. Store snapshots in order items: product name, variant name, SKU, unit price, discount, tax, currency.

Never make old orders depend on today's product record to explain what the customer bought.

### Soft-delete policy

Use soft deletion selectively for entities where recovery/history matters, such as products, pages, customers, or media.

Do not soft-delete completed orders or payment records and then treat them as if they never existed. Use explicit business state for transactional records.

### Analytics data separation

Do not allow high-volume raw storefront events to grow the main transactional tables indefinitely.

Keep useful daily/hourly rollups in Postgres for dashboard queries, while raw/high-volume event data should use an analytics/event system.

### Data access layer

Do not scatter raw SQL throughout route handlers and components.

```text
Request → authentication → authorization / tenant resolution
        → service layer → repository / query layer → PostgreSQL
```

Prefer tenant-aware repository methods. Avoid methods that accept only an entity ID for tenant-owned resources.

### ORM / query tooling

Use one consistent typed database access strategy. Drizzle or another suitable typed SQL layer is acceptable. Raw SQL is allowed for migrations, performance-critical queries and PostgreSQL-specific functionality, but keep it centralized and reviewed.

Do not introduce several ORMs for the same database.

### Migration strategy

All schema changes must be migration-driven and version controlled. Migrations should be backward-compatible during rolling deployments where possible. Large production tables require special care to avoid long blocking operations.

### Seed data

Create deterministic seeds for supported industries, default roles and permissions, templates, plans/entitlements, platform settings and demo content. Seed scripts must never overwrite real merchant data.

### Environment and branch strategy

Keep database environments explicitly separated. Never let a local developer workflow casually run destructive queries against production.

### Secrets and credentials

Use different credentials/secrets for development, staging and production. Database URLs, passwords and tokens must never live in frontend bundles or source control.

Credential rotation: rotate/create new credential, update secret, validate connectivity, revoke the old credential.

### Backup and recovery

Document explicit recovery objectives before production launch. Protect both infrastructure failure and application mistakes using database recovery/restore capability, migration checkpoints, immutable published website versions, audit logs, merchant exports and tested recovery procedures.

Do not claim recovery works until an actual restore test has been performed.

### Merchant data export and deletion

Provide controlled export jobs for merchant-owned data. Deletion workflows must account for legal, financial, audit and platform-retention requirements.

### Data retention

```text
Orders/payments       → long-lived according to legal/accounting requirements
Audit logs            → controlled long retention
Raw analytics events  → shorter retention / aggregate thereafter
Sessions              → short retention
Verification tokens   → very short retention
Draft revisions       → configurable/prunable
```

Do not retain raw personal/behavioral data indefinitely simply because storage exists.

### Row-level security / defense in depth

Consider PostgreSQL Row-Level Security for tenant-owned tables as an additional defense layer. It must complement application-level authorization, not replace it.

Cross-tenant access must still be covered by automated security tests.

### Query safety and pagination

All dynamic values must use parameterized queries/typed query APIs. Protect against SQL injection, unsafe dynamic sort fields, unbounded queries, expensive wildcard filters and N+1 queries.

Use server-side pagination for large products, orders, customers, audit logs and admin tables. Use cursor-based pagination for very high-volume feeds where appropriate.

### Cache boundary

Postgres is the source of truth. Cache only derived/read-heavy information.

Good cache candidates: hostname → website mapping, published storefront snapshots, template metadata, feature/configuration data, public catalog responses where invalidation is safe.

Do not casually cache: current inventory, payment state, order totals, authorization decisions.

### Database observability

Track query latency, slow queries, connection/pool pressure, failed transactions, deadlocks, migration failures, storage growth, largest tables, index usage, database error rate.

Create platform-admin database health views without exposing raw database credentials or arbitrary SQL execution to normal administrators.

### Scaling path

Start simple: one project, one production database, shared multi-tenant schema. Scale in this order where measurement justifies it: query optimization, index optimization, edge/cache optimization, connection pooling, analytics separation, data retention/archival, read-heavy optimizations, tenant isolation/sharding only when truly necessary.

Do not prematurely create a distributed database architecture.

### Database acceptance criteria

The database layer is not complete until:

- BuilderHut has its own Neon project
- development/staging/production environments are separated
- database credentials are secret-managed
- multi-tenant isolation is enforced server-side
- tenant-owned tables use tenant/store ownership correctly
- cross-tenant access tests exist
- migrations are version controlled
- foreign keys and uniqueness constraints exist
- money is not stored as floating point
- historical orders preserve their purchased values
- inventory updates are transactional
- critical mutations support idempotency
- published website versions are immutable
- analytics cannot overwhelm transactional data
- backup/recovery procedures are documented and tested
- merchant export/deletion workflows are defined
- database observability exists
- no secrets are committed to source control

---

# 36. API ARCHITECTURE

Keep a clean service/API layer.

Example domains: `/api/auth/*`, `/api/tenants/*`, `/api/websites/*`, `/api/pages/*`, `/api/builder/*`, `/api/products/*`, `/api/orders/*`, `/api/customers/*`, `/api/payments/*`, `/api/domains/*`, `/api/analytics/*`, `/api/platform/*`

Validate requests with a schema system.

Recommended patterns: typed request/response contracts, centralized authorization, service layer, repository/data access layer, idempotency keys for payment/order operations, consistent API errors.

---

# 37. FRONTEND APPLICATION STRUCTURE

```text
apps/      marketing/  dashboard/  builder/  storefront/  platform-admin/
packages/  ui/  design-system/  editor-core/  schema/  auth/  api-client/
           validation/  analytics/  payments/  domains/  templates/  shared/
```

A monorepo is preferred so shared types/components remain consistent.

---

# 38. DESIGN SYSTEM

Create the design system before building dozens of screens.

Core tokens: color, typography, radius, shadow, spacing, motion, z-index, breakpoints.

Components: Button, IconButton, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Tabs, Tooltip, Popover, Dropdown, Modal, Drawer, Toast, Table, Card, Badge, Avatar, Breadcrumb, Pagination, Command palette, Date picker, Chart wrapper, Empty state, Skeleton.

All major screens must use the shared system.

---

# 39. UI MOTION

Motion is a core part of the brand experience. The application should feel alive, refined, and responsive without becoming noisy.

Required motion categories: page and route transitions, staggered content reveals, button press feedback, hover elevation/transform, spring drawers and popovers, command palette transitions, builder selection transitions, drag preview and drop-zone indicators, responsive breakpoint transitions, chart entrance animation, number/count-up transitions, publish/deploy success choreography, template preview transitions, modal and sheet transitions, skeleton-to-content transitions.

Use motion tokens for duration, easing, spring stiffness, damping, and distance.

Animations must remain performant, primarily using transform and opacity. Avoid unnecessary layout animation.

Respect `prefers-reduced-motion`.

Never add animation merely to demonstrate an animation library. Motion should reinforce hierarchy, feedback, continuity, orientation, or delight.

---

# 40. DARK MODE

Support light and dark mode for platform/dashboard/builder.

Do not simply invert colors.

Create explicit semantic tokens: background, surface, elevated surface, text, muted text, border, accent, danger, success.

Storefront themes may independently define their appearance.

---

# 41. EMPTY STATES

Do not show blank tables.

Products: `Your catalog is empty` / `Add your first product and start building your store.` CTA: `Add product`

Orders: `No orders yet` / `Once customers purchase from your store, orders will appear here.`

Analytics: `Your analytics will appear after your store starts receiving visits.`

---

# 42. LOADING / ERROR STATES

Every screen needs: loading, skeleton, empty, partial failure, retry, permission denied, not found.

Never leave users staring at an empty page because an API request failed.

---

# 43. COMMAND CENTER

Add a command palette to the merchant dashboard: add product, open builder, view orders, search customer, open analytics, publish store, copy store link, manage domain.

Keyboard shortcut: `Cmd/Ctrl + K`

Platform admin can have the same feature.

---

# 44. ONBOARDING CHECKLIST

After first login: `Welcome, Akash's Store`

Checklist: add logo, add first product, select homepage, customize theme, configure checkout, configure shipping, test payment, publish. With a progress bar.

---

# 45. TEMPLATE PREVIEW EXPERIENCE

A template card should show cover image, industry, number of pages, mobile preview, theme colors, preview button, use template button.

When clicked: open a realistic full-browser preview with device toggles.

Do not force the user to install before previewing.

---

# 46. TEMPLATE MARKETPLACE — FUTURE

Allow third-party template designers later.

Template metadata: creator, version, compatibility, industry, price/free, installs, rating, update history.

Revenue share could be introduced later.

---

# 47. MERCHANT PLAN / BILLING — FUTURE READY

Even if the initial product is free, model plans: Free, Starter, Growth, Pro.

Feature limits: stores, products, staff, storage, custom domains, analytics retention, templates, AI credits, abandoned cart, advanced analytics.

Do not entangle feature checks directly with UI. Use a server-side entitlement service.

---

# 48. PLATFORM MONETIZATION — FUTURE

Potential revenue sources: monthly subscription, platform transaction fee, premium templates, domain margin, AI generation credits, email/SMS add-ons, advanced analytics, additional storage.

Build the architecture so these can be enabled independently.

---

# 49. OBSERVABILITY

Platform-level health page: request count, error rate, P95 latency, worker failures, queue backlog, database errors, storage failures, domain failures, payment simulation failures.

Per-tenant health: last request, last publish, error count, current domain status.

Use structured logs and correlation/request IDs.

---

# 50. ABUSE / MODERATION

Because users can publish public websites, include: report store, suspend site, disable domain, disable merchant, audit trail.

Content moderation hooks should exist for future AI-assisted scanning.

---

# 51. PERFORMANCE TARGETS

Aim for fast initial storefront load, minimal JavaScript for public storefront, optimized images, CDN caching, edge-first request routing.

Builder can be heavy; storefront must remain lean.

Do not ship the entire builder bundle to customer storefronts.

---

# 52. ACCESSIBILITY

Minimum requirements: keyboard navigation, focus states, labels, ARIA where necessary, color contrast, screen reader-friendly structure, reduced motion support.

The builder should also allow merchants to enter alt text.

---

# 53. INTERNATIONALIZATION

Prepare for multiple currencies, time zones, locale-aware numbers, date formats, language files, RTL later.

Store currency as a store-level configuration rather than assuming the user's browser locale.

---

# 54. MOBILE EXPERIENCE

Merchant dashboard should be responsive but not necessarily identical to desktop.

Mobile dashboard priorities: orders, notifications, analytics snapshot, product quick edit, store preview, publish.

Builder mobile experience should use a dedicated compact inspector pattern rather than trying to squeeze three columns onto a phone.

---

# 55. PRODUCT QUICK EDIT

From dashboard product list, allow price edit, stock edit, status, category, featured toggle.

Use inline editing with save/cancel.

---

# 56. ORDER QUICK ACTIONS

From order list: mark processing, mark packed, mark shipped, refund, add note, open order.

Respect permissions.

---

# 57. CUSTOMER EXPERIENCE ENHANCEMENTS

Later: wishlist reminders, back-in-stock alerts, price-drop alerts, review requests, loyalty points, referral links.

---

# 58. LEGAL / POLICY PAGES

Provide editable templates for privacy policy, terms, shipping policy, refund policy, cancellation policy, contact information.

These are templates, not jurisdiction-specific legal advice. Merchant should review/modify them before publishing.

---

# 59. PUBLISH FLOW

Click `Publish`. Open a publication panel.

Store readiness: ✓ Logo ✓ Product ✓ Checkout ✓ Payment ✓ Shipping ✓ Policies ✓ Mobile preview

Domain: ○ Platform domain  ○ Custom domain

Then: `Publish store`

Display deployment progress: validating, building snapshot, publishing, updating routing, live.

Success screen: `Your store is live`

Actions: visit store, copy link, share, continue editing.

---

# 60. DOMAIN ROUTING ARCHITECTURE

```text
Customer Browser → Edge → Host / Custom Domain → Storefront
      ├──> Domain Mapping
      ├──> Published Store Config
      ├──> Product/Catalog Data
      ├──> R2 Media
      └──> Analytics Event
                    → Rendered Store
```

Use a domain mapping table: `hostname -> websiteId -> tenantId -> status`. Cache hot host lookups.

---

# 61. PLATFORM ARCHITECTURE

The architecture intentionally separates the **compute layer**, **SQL data**, **object storage**, **KV/cache/config**, and **analytics** instead of using KV as the primary datastore.

---

# 62. BUILDER DATA FLOW

```text
User edits section → local editor state → autosave draft → API → save draft version
User publishes     → validate + create published snapshot → prepare live config
                   → update hot published config → live
Visitor opens store → resolve published config → render storefront
```

---

# 63. IMPORTANT EDITOR ARCHITECTURE RULE

Do not store generated HTML/CSS as the canonical source.

Store structured content + component configuration:

`Section -> Component -> Props -> ResponsiveProps -> StyleTokenReferences`

Then render the same structure into the editor canvas, preview, and live storefront.

This makes editing, versioning, templates, AI modifications, validation, and responsive behavior much easier.

---

# 64. DESIGN A COMPLETE STORE IN ONE CLICK

Add a high-impact onboarding option: `Generate my store`

Merchant enters: `I sell handmade crochet gifts in Chennai.`

The system proposes business name options, color palette, typography pair, homepage structure, product categories, About section, FAQ, store policies starter content, hero copy, SEO metadata.

The user can accept everything or edit each piece.

Use structured generation, not raw code generation.

---

# 65. DRAGGABLE EVERYWHERE

Apply drag/drop to page sections, components, navigation items, product ordering, collection ordering, dashboard cards where relevant, media arrangement, gallery images, variant ordering.

For forms and data tables, use drag/drop only where it improves usability.

Do not make every control draggable just for the sake of it.

---

# 66. PREVIEW MODES

Builder: desktop, tablet, mobile preview.

Store: customer preview, logged-in customer preview, cart populated preview, checkout preview.

Publish: draft, live, previous published version.

---

# 67. DEMO MODE

Build seeded demo tenants for the platform owner's demo environment: crochet shop, T-shirt store, invitation studio, jewellery shop, bakery.

These are useful for demonstrating the product without needing a real merchant account.

---

# 68. ADMIN STORE DETAIL PAGE

Header: store name, owner, status, domain, industry, created date.

Tabs: Overview, Storefront, Products, Orders, Customers, Analytics, Revenue, Domains, Activity, Audit.

Right-side actions: open store, view dashboard, suspend, contact merchant.

---

# 69. PLATFORM ADMIN STORE ANALYTICS

Show visits, unique visitors, page views, sessions, product views, add to carts, checkout starts, orders, conversion rate, GMV, refunds, net sales, revenue by source.

Graphs should compare period-over-period. Example: `+12.4% vs previous 30 days`

The comparison label must identify the comparison period.

---

# 70. ERROR CENTER

Columns: time, store, endpoint, error type, severity, request ID, status.

Filters: critical, high, medium, low, last hour, last day, last week.

Actions: view details, open related store, mark resolved.

---

# 71. SUPPORT CENTER

Merchant support: help center, search articles, contact support, system status.

Platform admin: support tickets, customer conversations, priority, status, internal notes.

Later: AI support assistant.

---

# 72. SYSTEM SETTINGS

Platform settings: platform name, branding, email sender, default currency, default locale, feature flags, payment providers, domain provider, analytics, storage, security.

Use environment-backed secrets; never put provider secrets in the frontend.

---

# 73. FEATURE FLAGS

Create feature flags from day one: new_builder, ai_assistant, advanced_analytics, custom_domains, template_marketplace, real_payments, staff_accounts.

Allow platform admins to enable features safely.

---

# 74. TESTING STRATEGY

Unit tests: pricing, discount rules, taxes, shipping, cart totals, payment state machine, authorization, domain validation.

Integration tests: sign up, email verification, store creation, product creation, checkout, dummy payment, order creation, refund, publish, domain mapping.

E2E tests: merchant creates store, merchant customizes template, merchant publishes, customer purchases, admin sees analytics.

Security tests: cross-tenant access, broken object-level authorization, session misuse, privilege escalation.

---

# 75. ORDER / PAYMENT STATE MACHINE

```text
CART → CHECKOUT_STARTED → PAYMENT_PENDING → PAID → PROCESSING
     → SHIPPED / READY_FOR_PICKUP → DELIVERED
PAYMENT_PENDING → PAYMENT_FAILED
DELIVERED → REFUND_REQUESTED → REFUNDED
```

Make transitions validated server-side.

Do not let the browser arbitrarily set an order to `PAID`.

---

# 76. DUMMY PAYMENT FLOW

```text
Customer → Checkout → Create Payment Intent → Dummy Gateway
   → Success / Failure / Pending → Payment Result
   → Create/confirm Order → Analytics Event
```

Use idempotency so a customer refreshing the success page does not create duplicate orders.

---

# 77. DATA PRIVACY

Build privacy controls from the beginning: customer data export later, customer deletion/anonymization later, consent records, data retention policy, admin access logging.

Do not collect data that isn't needed.

---

# 78. STORE CUSTOMIZATION LEVELS

Level 1 — Beginner: template, colors, fonts, text, images, product data.

Level 2 — Advanced: section order, layout, spacing, responsive rules, animations.

Level 3 — Pro: custom CSS (later), custom code blocks (later, sandboxed), advanced domain configuration, advanced SEO.

Do not expose dangerous complexity to every new user.

---

# 79. PRODUCT IMPORT

Support later: CSV import, spreadsheet mapping, bulk image upload, product duplicate, export.

Import flow: upload, map columns, validate, preview, import, show errors.

---

# 80. PRODUCT VARIANTS

Support size, color, material, pattern, custom option.

Each variant can have SKU, price, inventory, image, weight.

Builder should automatically understand variant selectors on product pages.

---

# 81. CUSTOM PRODUCT REQUESTS

Especially important for invitation/crochet/custom businesses.

Product option types: text input, long text, date, file upload, dropdown, color picker, checkbox.

Example: `Upload invitation photo`, `Enter names`, `Event date`.

Store the submitted data with the order.

---

# 82. SERVICES / NON-PHYSICAL PRODUCTS

Allow store type: physical products, digital products, services, custom orders.

Service mode can later support booking, time slots, appointment requests.

This makes the platform useful beyond e-commerce.

---

# 83. HOME / LANDING PAGE BUILDER

Merchant should be able to design landing pages, campaign pages, collection pages, about pages, lead-capture pages.

A website can contain multiple pages, not just one store homepage.

---

# 84. REVIEWS

Customer review model: rating, title, comment, customer display name, product, verified purchase flag, merchant response, moderation status.

Merchant can configure: enable/disable reviews, manual approval.

---

# 85. WISHLIST

Customer can add product, remove product, see saved items.

Later: wishlist sharing, wishlist reminders.

---

# 86. STORE SEARCH UX

Search overlay should feel instant. Show recent searches, products, categories, suggested results.

No results state: `We couldn't find that` — suggest categories or popular products.

---

# 87. PLATFORM HOME DASHBOARD VISUAL HIERARCHY

Row 1: 4–6 KPI cards.
Row 2: Revenue / GMV chart (wide) + New merchants (narrow).
Row 3: Traffic chart (wide) + Top stores (narrow).
Row 4: Recent stores table (full width).
Row 5: System health + recent incidents.

Do not fill every space. Use whitespace deliberately.

---

# 88. MERCHANT DASHBOARD VISUAL HIERARCHY

Header: `Good morning, [merchant]`
Subheader: `Here's what's happening with your store.`

Top: Revenue, Orders, Visitors, Conversion.
Middle: Revenue chart + recent orders.
Bottom: Top products + store health + quick actions.

Right-side optional assistant panel later.

---

# 89. BUILDER VISUAL HIERARCHY

Top bar must be compact. Canvas should dominate the screen. Inspector must be contextual and scrollable.

Avoid having five nested modal windows open at once.

Prefer drawers, popovers, tabs, inline editors.

---

# 90. ROUTING MODEL

```text
Platform:           platform.example.com
Merchant dashboard: platform.example.com/app
Builder:            platform.example.com/app/sites/:siteId/builder
Platform admin:     platform.example.com/admin
Published stores:   shop-slug.example-store-host.com
Custom domain:      mystore.com
```

---

# 91. NO-CODE SAFETY

The builder can modify schema values, not application logic.

Whitelist component properties. Validate URLs, colors, spacing values, image identifiers, text lengths, number ranges. Sanitize rich text.

Custom HTML/CSS/JS should be a later, restricted feature with strong sandboxing.

---

# 92. SEO/PUBLISH VALIDATION

Before publish: homepage exists, store name exists, at least one product if e-commerce mode, valid product prices, no broken internal links, images have alt text warnings, domain configuration is valid, payment mode configured, shipping configured where required, required policies configured.

Warnings should not all be hard blockers. Differentiate critical, warning, recommendation.

---

# 93. ACCESS / PERMISSION MODEL

Every merchant request should pass: authentication → tenant resolution → role authorization → resource ownership → business-rule validation.

Never: browser says `tenantId=XYZ` → API trusts it.

---

# 94. CACHE STRATEGY

Good candidates: published site config, domain → website mapping, template metadata, public category pages, public product data.

Do not blindly cache: customer account pages, cart, checkout, admin dashboard data, payment state.

A key/value cache should not replace the transactional relational store for orders/products/users.

---

# 95. ASYNC JOBS

Queue jobs for email sending, image processing, analytics rollups, store publication background tasks, domain verification polling, import processing, export generation, notification delivery.

Use retry logic and dead-letter handling.

---

# 96. FUTURE REAL PAYMENT INTEGRATION

The merchant should eventually select: Payments → Provider → Credentials → Test mode → Live mode.

Provider interface should normalize payment intent, capture, refund, webhook event, signature verification.

The order system should depend on normalized payment states, not a specific gateway.

---

# 97. PLATFORM BILLING

Platform plan billing should remain separate from merchant customer checkout.

Platform billing: merchant pays SaaS subscription.
Merchant checkout: merchant's customers buy merchant products.

Never mix the two ledgers.

---

# 98. AUDITABLE REVENUE MODEL

Every monetary event should have currency, amount, type, status, source, reference, createdAt.

Prefer integer minor units for money storage rather than floating point.

Example: `9999` paise = ₹99.99 when currency exponent is 2.

---

# 99. RELEASE PLAN

**Phase 1 — Foundation:** auth, email verification, tenant creation, dashboard shell, basic theme system, schema, media, product management, one template, store preview, basic storefront.

**Phase 2 — Builder:** drag/drop sections, component registry, inspector, responsive editor, autosave, undo/redo, draft/publish, template import.

**Phase 3 — Commerce:** cart, checkout, dummy payment, orders, customers, discounts, shipping, taxes.

**Phase 4 — Hosting:** platform subdomains, domain mapping, custom domains, SSL/status UX, publish pipeline.

**Phase 5 — Analytics:** events, merchant analytics, platform analytics, revenue metrics, top store metrics.

**Phase 6 — Platform Admin:** user explorer, store explorer, revenue dashboard, analytics dashboard, domain dashboard, error center, audit logs.

**Phase 7 — Polish:** motion, templates, AI assistant, performance, accessibility, mobile experience, empty states, error states.

**Phase 8 — Growth:** subscriptions, real payment gateways, domain purchasing, template marketplace, staff accounts, marketing tools, integrations.

---

# 100. DEFINITION OF DONE FOR MVP

A new merchant can:

1. Sign up
2. Verify email
3. Create admin account
4. Choose business type
5. Pick a template
6. Create a store
7. Customize homepage visually
8. Drag/reorder sections
9. Edit colors/text/images
10. Add products
11. Add categories
12. Configure prices/inventory
13. Preview product page
14. Open cart
15. Checkout
16. Complete dummy payment
17. See order in admin
18. View revenue
19. View basic visitors/clicks
20. Publish to a platform subdomain
21. Open the public store
22. Log in as customer
23. View order history
24. Connect a custom domain through the domain workflow
25. See the site from the platform owner's admin console

---

# 101. CLAUDE IMPLEMENTATION INSTRUCTIONS

Behave as a senior product engineer + UX architect.

1. Do not create a generic CRUD dashboard.
2. Do not use placeholder boxes where a realistic screen can be built.
3. Build real navigation and real state flows.
4. Use a shared design system.
5. Keep tenant isolation in every backend operation.
6. Build the data model before creating many pages.
7. Implement dummy payment through an abstraction layer.
8. Keep storefront rendering separate from the builder.
9. Use structured page schemas instead of storing generated HTML as the canonical source.
10. Make the builder responsive.
11. Build loading, empty, error, and success states.
12. Make the dashboard polished in both light and dark modes.
13. Use realistic demo data for screenshots/demo mode.
14. Keep secrets server-side.
15. Use feature flags for incomplete capabilities.
16. Do not claim an integration is working if it is only mocked.
17. Add clear TODO boundaries for future real providers.
18. Prefer composable components over huge monolithic pages.
19. Build mobile support deliberately rather than only scaling desktop.
20. Make every publish operation versioned and reversible.

---

# 102. RECOMMENDED INITIAL TECH STACK

Frontend: React, TypeScript, modern routing, Tailwind or a structured CSS token system, dnd-kit or equivalent drag/drop, a high-quality accessible component library or custom design system, a chart library for dashboards.

Backend: TypeScript, SQL data layer, object storage, key/value cache, queues, analytics pipeline.

Auth: session-based secure authentication, OAuth providers later, email verification provider abstraction.

Validation: Zod or equivalent.

ORM/query layer: Drizzle or direct SQL depending on project maturity.

Testing: unit + integration + Playwright E2E.

---

# 103. WHAT NOT TO DO

Do not:
- Use a key/value store as the only database
- Store all data in one giant JSON blob
- Couple the editor to raw generated HTML
- Put payment logic in React components
- Trust tenant IDs from the browser
- Build only desktop UI
- Make every screen a modal
- Ship the admin builder code to public storefronts
- Store secrets in frontend environment variables
- Use floating point for currency
- Hard-code one country's tax rules into the architecture
- Treat merchant GMV as SaaS revenue
- Allow arbitrary customer JavaScript in the public storefront without sandboxing

---

# 104. FINAL PRODUCT VISION

The final product should feel like:

**"Tell us what you sell. Pick a beautiful starting point. Customize everything visually. Add your products. Publish. Start selling."**

The platform should hide technical complexity from merchants while preserving a professional architecture underneath.

The most important differentiators:

1. Extremely polished templates
2. A genuinely enjoyable drag-and-drop editor
3. Industry-specific onboarding
4. A beautiful merchant dashboard
5. A powerful platform-owner dashboard
6. Clear analytics from visitor → click → cart → payment → order → revenue
7. Easy free hosting + custom domain support
8. Strong multi-tenant architecture
9. Dummy payments now, real payment providers later
10. AI-assisted store creation without giving up structured visual editing

---

# 105. MASTER BUILD REQUEST

Build this as a serious production-grade SaaS prototype, not a landing-page mockup.

Start by designing the architecture, data model, route map, component system, tenant model, authentication flow, page schema, builder schema, payment abstraction, hosting model, and analytics event model.

Then implement the application incrementally:

1. Design system
2. Authentication and email verification flow
3. Merchant onboarding
4. Tenant/store creation
5. Merchant dashboard
6. Product management
7. Template system
8. Visual builder
9. Storefront renderer
10. Cart/checkout
11. Dummy payments
12. Orders/customers
13. Publish/versioning
14. Platform hosting/subdomain
15. Analytics
16. Platform admin console
17. Custom domain workflow

At every stage, keep the UI exceptionally polished and realistic. This is a flagship visual product, not an admin-template exercise.

Before implementing a feature, define its visual hierarchy, states, interaction behavior, motion, responsive behavior, empty state, loading state, error state, and accessibility behavior.

Use seeded demo data so the dashboards immediately look alive.

The frontend must maintain a distinctive visual identity across the marketing site, onboarding, merchant app, builder, storefronts, checkout, and platform admin console. The surfaces should feel related but not identical.

Before considering the project complete, test the complete journey:

Visitor → Sign up → Email verify → Create store → Choose template → Customize → Add product → Publish → Visit store → Add to cart → Checkout → Dummy payment → Merchant sees order → Merchant sees revenue → Platform admin sees store/traffic/revenue → Custom domain workflow.

The application should be structured so real payment gateways, real domain purchase APIs, additional templates, team accounts, subscriptions, AI features, and external integrations can be added without rebuilding the core architecture.
