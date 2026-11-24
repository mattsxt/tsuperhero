import { Routes } from "@/constants/routes";
import HomeTabs from "@/pages/home-tabs/page";

export default function TransitHomeRoute() {
  return <HomeTabs initial="home" homeRoute={Routes.transitHome} />;
}
