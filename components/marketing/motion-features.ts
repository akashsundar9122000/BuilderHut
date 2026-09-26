/*
 * The motion feature bundle, in a module of its own so it can be imported
 * lazily. See MotionRoot for why.
 *
 * domMax rather than domAnimation because the template tabs slide one shared
 * indicator between them with `layoutId`, and layout animation is the part
 * domAnimation leaves out.
 */
import { domMax } from "motion/react";

export default domMax;
