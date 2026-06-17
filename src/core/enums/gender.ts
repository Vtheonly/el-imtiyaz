export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  UNSPECIFIED = 'unspecified'
}

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Male',
  [Gender.FEMALE]: 'Female',
  [Gender.UNSPECIFIED]: 'Unspecified'
};
