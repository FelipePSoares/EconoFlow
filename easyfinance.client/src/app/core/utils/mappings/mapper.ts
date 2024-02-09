import { createMapper } from '@automapper/core';
import { classes } from '@automapper/classes';

// Create and export the mapper
export const mapper = createMapper({
    strategyInitializer: classes(),
});