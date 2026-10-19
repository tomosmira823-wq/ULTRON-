// Shop templates — a ready-made strategy so a new user only has to add their API keys.
window.TEMPLATES = [
  {
    id: 'cottagecore', name: 'Cottagecore Florals', tagline: 'Soft floral and garden designs for women. The reel strategy.',
    brief: "Women's soft floral shirts: gardening, wildflowers, cottage life, plant lovers and gifts for mum. Gentle, pretty, giftable.",
    voice: 'Warm, gentle and a little whimsical. Talks like a friend who loves her garden.',
    tone: 'light', colours: 'White, Ivory, Natural, Blossom, Light Pink, Chalky Mint', price: 24.99,
  },
  {
    id: 'coffee', name: 'Coffee & Cosy', tagline: 'Cosy coffee-lover humour and slow-morning vibes.',
    brief: 'Coffee lovers, cosy mornings, iced coffee girls, latte art, tired-mum humour and cafe aesthetics.',
    voice: 'Cosy, witty and relatable. Short punchy lines.',
    tone: 'light', colours: 'White, Ivory, Natural, Sand, Light Pink', price: 23.99,
  },
  {
    id: 'bookish', name: 'Bookish', tagline: 'Book club, BookTok and reading-addict gifts.',
    brief: 'Readers and book clubs: BookTok tropes, library love, reading addict humour, fantasy and romance reader jokes. No real book titles or authors.',
    voice: 'Playful and clever, full of reader in-jokes.',
    tone: 'light', colours: 'White, Ivory, Natural, Blossom, Light Pink', price: 24.99,
  },
  {
    id: 'pets', name: 'Pet Parents', tagline: 'Dog mum, cat dad and breed-specific humour.',
    brief: 'Dog mums, cat dads and breed lovers: funny pet-parent slogans, cute breed illustrations, rescue pride. Gifts for pet owners.',
    voice: 'Funny, affectionate and a bit chaotic, like a pet owner talking about their dog.',
    tone: 'light', colours: 'White, Ivory, Natural, Sand, Light Blue', price: 23.99,
  },
  {
    id: 'seasonal', name: 'Seasonal Autopilot', tagline: 'Follows a live holiday calendar with order cut-off dates.',
    brief: 'Seasonal and holiday gifts. Follow the selling calendar: design mostly for holidays marked PRIME, maybe one quick design for a LAST CHANCE holiday, and skip anything TOO LATE.',
    voice: 'Fun, festive and giftable, matched to the season.',
    tone: 'light', colours: 'White, Ivory, Natural, Black', price: 23.99,
  },
  {
    id: 'professions', name: 'Profession Gifts', tagline: 'Teachers, nurses, electricians, engineers and more.',
    brief: 'Gifts for professions: teachers, nurses, electricians, engineers, mechanics, vets, accountants. Funny job slogans, appreciation gifts, retirement and new-job gifts.',
    voice: 'Proud and funny, full of job in-jokes that people in that trade get.',
    tone: 'light', colours: 'White, Ivory, Natural, Sand', price: 23.99,
  },
  {
    id: 'outdoors', name: 'Retro Outdoors', tagline: 'Vintage hiking, camping and national-park style badges on dark tees.',
    brief: 'Hiking, camping, fishing, mountains and lakes in a retro badge style: sunsets, pine trees, adventure slogans. No real park logos.',
    voice: 'Adventurous, nostalgic and outdoorsy.',
    tone: 'dark', colours: 'Black, Navy, Forest, Dark Heather, Pepper', price: 25.99,
  },
  {
    id: 'custom', name: 'Custom', tagline: 'Start blank and write your own brief.',
    brief: '', voice: 'Friendly and clear.', tone: 'light', colours: 'White', price: 24.99,
  },
];
// Blank tees we try in order when picking a product automatically.
window.PREFERRED_BLANKS = [
  { brand: 'Comfort Colors', model: '1717' },
  { brand: 'Bella', model: '3001' },
  { brand: 'Gildan', model: '5000' },
  { brand: 'Gildan', model: '64000' },
];
