// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library RouterLib {
    function arr2(address a, address b) internal pure returns (address[] memory p) {
        p = new address[](2);
        p[0] = a; p[1] = b;
    }

    function arr3(address a, address b, address c) internal pure returns (address[] memory p) {
        p = new address[](3);
        p[0] = a; p[1] = b; p[2] = c;
    }

    function arr4(address a, address b, address c, address d) internal pure returns (address[] memory p) {
        p = new address[](4);
        p[0] = a; p[1] = b; p[2] = c; p[3] = d;
    }
}
