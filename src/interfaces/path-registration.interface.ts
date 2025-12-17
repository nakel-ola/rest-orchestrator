import { Type } from "@nestjs/common";

export interface PathRegistration {
  service: Type<any>;
  method: string;
  httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

export interface PathRegistryMap {
  [path: string]: PathRegistration;
}
