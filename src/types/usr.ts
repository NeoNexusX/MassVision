export interface User{
  username: string,
  email: string,
}
export interface UsrSignup extends User{
  password: string,
  active: true, //default must be True
  verify_code: string,
  institution: string,
  position: string,
  research_field: string,
  region: string,
  orcid: string,
  homepage: string,

}

export interface UsrLogin {
  username: string;
  password: string;
}

export interface UsrProfile extends User{
  identity: string,
  institution: string,
  position: string,
  research_field: string,
  region: string,
  orcid: string,
  homepage: string,
}
