/**
 * Pipelines — explicit, ordered, named stages for cross-cutting flows.
 *
 * Why a pipeline abstraction?
 *  - Makes side-effect ordering visible (e.g. validate → record → allocate → audit → notify).
 *  - Each stage is independently testable.
 *  - Failures produce a structured trace pointing to the failing stage.
 */

export { PaymentPipeline } from './payment-pipeline';
export { DiscountPipeline } from './discount-pipeline';
export { ReportPipeline } from './report-pipeline';
