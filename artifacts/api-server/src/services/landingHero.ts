import { z } from "zod";

// One setting makes changes to both layers atomic; reject truthy strings.
export const landingHeroSchema = z
  .object({
    slideshowEnabled: z.boolean(),
    aircraftEnabled: z.boolean(),
  })
  .strict();
